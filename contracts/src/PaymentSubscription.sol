// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBEP20} from "./lib/IBEP20.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {Ownable} from "./lib/Ownable.sol";
import {ReentrancyGuard} from "./lib/ReentrancyGuard.sol";
import {Pausable} from "./lib/Pausable.sol";
import {IPaymentSubscription} from "./IPaymentSubscription.sol";

/**
 * @title PaymentSubscription
 * @author @dreamer/payment
 * @notice Payment subscription contract - supports one-time payments and recurring subscriptions
 * @dev Implements IPaymentSubscription interface
 *
 * Features:
 * - Subscription plan management (create, update, query)
 * - Subscription management (subscribe, cancel, pause, resume)
 * - Automatic charging (requires backend scheduled calls)
 * - One-time payments
 * - Refund functionality
 *
 * Usage flow:
 * 1. Merchant calls createPlan to create a subscription plan
 * 2. User first calls token contract's approve to authorize this contract
 * 3. User calls subscribe to create subscription (first charge executes immediately)
 * 4. Backend periodically calls charge or batchCharge to execute due payments
 * 5. User can call cancelSubscription / pauseSubscription at any time
 */
contract PaymentSubscription is Ownable, ReentrancyGuard, Pausable, IPaymentSubscription {
  using SafeERC20 for IBEP20;

  // ============================================================================
  // Constants
  // ============================================================================

  /// @notice Contract version
  string public constant VERSION = "1.0.0";

  /// @notice Maximum batch processing size
  uint256 public constant MAX_BATCH_SIZE = 100;

  // ============================================================================
  // Enums
  // ============================================================================

  /// @notice Subscription status
  enum SubscriptionStatus {
    Active, // 0 - Active
    Paused, // 1 - Paused
    Canceled, // 2 - Canceled
    Expired // 3 - Expired (charge failed)
  }

  /// @notice Charge failure reason
  enum ChargeFailReason {
    Success, // 0 - Can charge
    NotDue, // 1 - Not due yet
    InsufficientBalance, // 2 - Insufficient balance
    NotApproved, // 3 - Not approved
    Paused, // 4 - Paused
    Canceled, // 5 - Canceled
    PlanInactive // 6 - Plan inactive
  }

  // ============================================================================
  // Structs
  // ============================================================================

  /// @notice Subscription plan
  struct Plan {
    bytes32 id; // Plan ID
    uint256 amount; // Amount per period
    address token; // Token address (address(0) = native token)
    uint32 interval; // Charge interval (seconds)
    address merchant; // Merchant address
    bool active; // Whether active
    uint256 subscriberCount; // Subscriber count
    uint256 createdAt; // Creation time
  }

  /// @notice Subscription information
  struct Subscription {
    bytes32 id; // Subscription ID
    bytes32 planId; // Plan ID
    address subscriber; // Subscriber
    SubscriptionStatus status; // Status
    uint256 startTime; // Start time
    uint256 currentPeriodStart; // Current period start
    uint256 currentPeriodEnd; // Current period end
    bool cancelAtPeriodEnd; // Cancel at period end
    uint256 pausedAt; // Paused time
    uint256 paymentCount; // Payment count
  }

  /// @notice Payment record
  struct Payment {
    bytes32 orderId; // Order ID
    address payer; // Payer
    address merchant; // Merchant
    uint256 amount; // Amount
    address token; // Token
    uint256 timestamp; // Timestamp
    bool paid; // Whether paid
  }

  /// @notice Payment history record
  struct PaymentRecord {
    uint256 amount; // Amount
    uint256 timestamp; // Timestamp
    uint256 periodStart; // Period start
    uint256 periodEnd; // Period end
  }

  // ============================================================================
  // State Variables
  // ============================================================================

  /// @notice Plan mapping planId => Plan
  mapping(bytes32 => Plan) public plans;

  /// @notice Plan ID list
  bytes32[] public planIds;

  /// @notice Subscription mapping subscriptionId => Subscription
  mapping(bytes32 => Subscription) public subscriptions;

  /// @notice Subscription ID list
  bytes32[] public subscriptionIds;

  /// @notice User subscriptions list user => subscriptionIds
  mapping(address => bytes32[]) public userSubscriptions;

  /// @notice Plan subscriptions list planId => subscriptionIds
  mapping(bytes32 => bytes32[]) public planSubscriptions;

  /// @notice Subscription payment history subscriptionId => PaymentRecord[]
  mapping(bytes32 => PaymentRecord[]) public subscriptionPayments;

  /// @notice One-time payment records orderId => Payment
  mapping(bytes32 => Payment) public payments;

  /// @notice Supported tokens list
  address[] public supportedTokens;

  /// @notice Token support status token => supported
  mapping(address => bool) public tokenSupported;

  /// @notice Subscription nonce (for generating unique IDs)
  uint256 private _subscriptionNonce;

  // ============================================================================
  // Events (inherited from IPaymentSubscription interface, only define additional events)
  // ============================================================================

  /// @notice Token added event
  event TokenAdded(address indexed token);

  /// @notice Token removed event
  event TokenRemoved(address indexed token);

  // ============================================================================
  // Modifiers
  // ============================================================================

  /// @notice Check if plan exists (modifier)
  modifier requirePlanExists(bytes32 planId) {
    _requirePlanExists(planId);
    _;
  }

  /// @notice Check if plan exists (internal function)
  /// @param planId Plan ID
  function _requirePlanExists(bytes32 planId) internal view {
    require(plans[planId].merchant != address(0), "Plan not found");
  }

  /// @notice Check if subscription exists (modifier)
  modifier requireSubscriptionExists(bytes32 subscriptionId) {
    _requireSubscriptionExists(subscriptionId);
    _;
  }

  /// @notice Check if subscription exists (internal function)
  /// @param subscriptionId Subscription ID
  function _requireSubscriptionExists(bytes32 subscriptionId) internal view {
    require(subscriptions[subscriptionId].subscriber != address(0), "Subscription not found");
  }

  /// @notice Check if caller is subscriber or merchant
  modifier onlySubscriberOrMerchant(bytes32 subscriptionId) {
    _onlySubscriberOrMerchant(subscriptionId);
    _;
  }

  /// @notice Check if caller is subscriber or merchant (internal function)
  /// @param subscriptionId Subscription ID
  function _onlySubscriberOrMerchant(bytes32 subscriptionId) internal view {
    Subscription storage sub = subscriptions[subscriptionId];
    Plan storage plan = plans[sub.planId];
    require(msg.sender == sub.subscriber || msg.sender == plan.merchant, "Not authorized");
  }

  /// @notice Check if plan exists (interface function implementation)
  /// @param planId Plan ID
  /// @return exists Whether exists
  function planExists(bytes32 planId) external view override returns (bool exists) {
    return plans[planId].merchant != address(0);
  }

  /// @notice Check if subscription exists (interface function implementation)
  /// @param subscriptionId Subscription ID
  /// @return exists Whether exists
  function subscriptionExists(bytes32 subscriptionId) external view override returns (bool exists) {
    return subscriptions[subscriptionId].subscriber != address(0);
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * @notice Constructor
   * @dev Contract deployer becomes the owner
   */
  constructor() {
    // Support native token by default
    tokenSupported[address(0)] = true;
    supportedTokens.push(address(0));
  }

  // ============================================================================
  // Admin Functions
  // ============================================================================

  /**
   * @notice Add supported token
   * @param token Token address
   */
  function addSupportedToken(address token) external onlyOwner {
    require(!tokenSupported[token], "Token already supported");
    tokenSupported[token] = true;
    supportedTokens.push(token);
    emit TokenAdded(token);
  }

  /**
   * @notice Remove supported token
   * @param token Token address
   */
  function removeSupportedToken(address token) external onlyOwner {
    require(token != address(0), "Cannot remove native token");
    require(tokenSupported[token], "Token not supported");
    tokenSupported[token] = false;

    // Remove from array
    for (uint256 i = 0; i < supportedTokens.length; i++) {
      if (supportedTokens[i] == token) {
        supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
        supportedTokens.pop();
        break;
      }
    }
    emit TokenRemoved(token);
  }

  /**
   * @notice Pause contract
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpause contract
   */
  function unpause() external onlyOwner {
    _unpause();
  }

  // ============================================================================
  // Plan Management
  // ============================================================================

  /**
   * @notice Create subscription plan
   * @param planId Plan ID
   * @param amount Amount per period
   * @param token Token address
   * @param interval Charge interval (seconds)
   * @param merchantAddress Merchant address
   */
  function createPlan(bytes32 planId, uint256 amount, address token, uint32 interval, address merchantAddress)
    external
    whenNotPaused
  {
    require(plans[planId].merchant == address(0), "Plan already exists");
    require(amount > 0, "Amount must be positive");
    require(interval >= 1 days, "Interval too short");
    require(merchantAddress != address(0), "Invalid merchant");
    require(tokenSupported[token], "Token not supported");

    plans[planId] = Plan({
      id: planId,
      amount: amount,
      token: token,
      interval: interval,
      merchant: merchantAddress,
      active: true,
      subscriberCount: 0,
      createdAt: block.timestamp
    });

    planIds.push(planId);

    emit PlanCreated(planId, merchantAddress, amount, token, interval);
  }

  /**
   * @notice Update plan status
   * @param planId Plan ID
   * @param active Whether active
   */
  function updatePlan(bytes32 planId, bool active) external requirePlanExists(planId) {
    Plan storage plan = plans[planId];
    require(msg.sender == plan.merchant || msg.sender == _owner, "Not authorized");

    plan.active = active;
    emit PlanUpdated(planId, active);
  }

  /**
   * @notice Query plan information
   * @param planId Plan ID
   */
  function getPlan(bytes32 planId)
    external
    view
    returns (uint256 amount, address token, uint32 interval, address merchant, bool active, uint256 subscriberCount)
  {
    Plan storage plan = plans[planId];
    return (plan.amount, plan.token, plan.interval, plan.merchant, plan.active, plan.subscriberCount);
  }

  /**
   * @notice Check if plan exists
   * @param planId Plan ID
   */
  function checkPlanExists(bytes32 planId) external view returns (bool) {
    return plans[planId].merchant != address(0);
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * @notice User creates subscription
   * @param planId Plan ID
   * @return subscriptionId Subscription ID
   */
  function subscribe(bytes32 planId)
    external
    payable
    whenNotPaused
    nonReentrant
    requirePlanExists(planId)
    returns (bytes32 subscriptionId)
  {
    return _subscribe(planId, 0);
  }

  /**
   * @notice User creates subscription (with trial period)
   * @param planId Plan ID
   * @param trialDays Trial days
   * @return subscriptionId Subscription ID
   */
  function subscribeWithTrial(bytes32 planId, uint32 trialDays)
    external
    whenNotPaused
    nonReentrant
    requirePlanExists(planId)
    returns (bytes32 subscriptionId)
  {
    return _subscribe(planId, trialDays);
  }

  /**
   * @notice Internal subscribe function
   * @param planId Plan ID
   * @param trialDays Trial days
   */
  function _subscribe(bytes32 planId, uint32 trialDays) internal returns (bytes32 subscriptionId) {
    Plan storage plan = plans[planId];
    require(plan.active, "Plan is inactive");

    // Generate subscription ID
    _subscriptionNonce++;
    subscriptionId = keccak256(abi.encodePacked(planId, msg.sender, block.timestamp, _subscriptionNonce));

    uint256 startTime = block.timestamp;
    uint256 periodStart = startTime;
    uint256 periodEnd = startTime + plan.interval;

    // If trial period exists
    if (trialDays > 0) {
      periodEnd = startTime + (uint256(trialDays) * 1 days);
    } else {
      // Charge immediately
      _executePayment(plan, msg.sender);
    }

    // Create subscription
    subscriptions[subscriptionId] = Subscription({
      id: subscriptionId,
      planId: planId,
      subscriber: msg.sender,
      status: SubscriptionStatus.Active,
      startTime: startTime,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      pausedAt: 0,
      paymentCount: trialDays > 0 ? 0 : 1
    });

    // Update indexes
    subscriptionIds.push(subscriptionId);
    userSubscriptions[msg.sender].push(subscriptionId);
    planSubscriptions[planId].push(subscriptionId);
    plan.subscriberCount++;

    // Record payment history (if no trial period)
    if (trialDays == 0) {
      subscriptionPayments[subscriptionId].push(
        PaymentRecord({amount: plan.amount, timestamp: block.timestamp, periodStart: periodStart, periodEnd: periodEnd})
      );

      emit PaymentExecuted(subscriptionId, plan.amount, block.timestamp, periodStart, periodEnd);
    }

    emit SubscriptionCreated(subscriptionId, planId, msg.sender, startTime);

    return subscriptionId;
  }

  /**
   * @notice Cancel subscription
   * @param subscriptionId Subscription ID
   * @param immediately Whether to cancel immediately
   */
  function cancelSubscription(bytes32 subscriptionId, bool immediately)
    external
    requireSubscriptionExists(subscriptionId)
    onlySubscriberOrMerchant(subscriptionId)
  {
    Subscription storage sub = subscriptions[subscriptionId];
    require(
      sub.status == SubscriptionStatus.Active || sub.status == SubscriptionStatus.Paused, "Subscription not active"
    );

    if (immediately) {
      uint8 oldStatus = uint8(sub.status);
      sub.status = SubscriptionStatus.Canceled;
      sub.currentPeriodEnd = block.timestamp;

      emit SubscriptionStatusChanged(subscriptionId, oldStatus, uint8(SubscriptionStatus.Canceled));
    } else {
      sub.cancelAtPeriodEnd = true;
    }

    emit SubscriptionCanceled(subscriptionId, block.timestamp, immediately);
  }

  /**
   * @notice Pause subscription
   * @param subscriptionId Subscription ID
   */
  function pauseSubscription(bytes32 subscriptionId)
    external
    requireSubscriptionExists(subscriptionId)
    onlySubscriberOrMerchant(subscriptionId)
  {
    Subscription storage sub = subscriptions[subscriptionId];
    require(sub.status == SubscriptionStatus.Active, "Subscription not active");

    uint8 oldStatus = uint8(sub.status);
    sub.status = SubscriptionStatus.Paused;
    sub.pausedAt = block.timestamp;

    emit SubscriptionStatusChanged(subscriptionId, oldStatus, uint8(SubscriptionStatus.Paused));
  }

  /**
   * @notice Resume subscription
   * @param subscriptionId Subscription ID
   */
  function resumeSubscription(bytes32 subscriptionId) external requireSubscriptionExists(subscriptionId) {
    Subscription storage sub = subscriptions[subscriptionId];
    require(msg.sender == sub.subscriber, "Only subscriber can resume");
    require(sub.status == SubscriptionStatus.Paused, "Subscription not paused");

    uint8 oldStatus = uint8(sub.status);
    sub.status = SubscriptionStatus.Active;

    // Extend period end time (compensate for paused duration)
    uint256 pausedDuration = block.timestamp - sub.pausedAt;
    sub.currentPeriodEnd += pausedDuration;
    sub.pausedAt = 0;
    sub.cancelAtPeriodEnd = false;

    emit SubscriptionStatusChanged(subscriptionId, oldStatus, uint8(SubscriptionStatus.Active));
  }

  /**
   * @notice Query subscription details
   * @param subscriptionId Subscription ID
   */
  function getSubscription(bytes32 subscriptionId)
    external
    view
    returns (
      address subscriber,
      bytes32 planId,
      uint8 status,
      uint256 startTime,
      uint256 currentPeriodStart,
      uint256 currentPeriodEnd,
      bool cancelAtPeriodEnd
    )
  {
    Subscription storage sub = subscriptions[subscriptionId];
    return (
      sub.subscriber,
      sub.planId,
      uint8(sub.status),
      sub.startTime,
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
      sub.cancelAtPeriodEnd
    );
  }

  /**
   * @notice Check if subscription exists
   * @param subscriptionId Subscription ID
   */
  function checkSubscriptionExists(bytes32 subscriptionId) external view returns (bool) {
    return subscriptions[subscriptionId].subscriber != address(0);
  }

  /**
   * @notice Get all subscriptions by user
   * @param subscriber Subscriber address
   */
  function getSubscriptionsByUser(address subscriber) external view returns (bytes32[] memory) {
    return userSubscriptions[subscriber];
  }

  /**
   * @notice Get all subscriptions by plan
   * @param planId Plan ID
   * @param offset Offset
   * @param limit Limit
   */
  function getSubscriptionsByPlan(bytes32 planId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory result, uint256 total)
  {
    bytes32[] storage subs = planSubscriptions[planId];
    total = subs.length;

    if (offset >= total) {
      return (new bytes32[](0), total);
    }

    uint256 end = offset + limit;
    if (end > total) {
      end = total;
    }

    result = new bytes32[](end - offset);
    for (uint256 i = offset; i < end; i++) {
      result[i - offset] = subs[i];
    }

    return (result, total);
  }

  // ============================================================================
  // Payment Execution
  // ============================================================================

  /**
   * @notice Execute subscription charge
   * @param subscriptionId Subscription ID
   * @return success Whether successful
   */
  function charge(bytes32 subscriptionId)
    external
    nonReentrant
    requireSubscriptionExists(subscriptionId)
    returns (bool success)
  {
    (bool canChargeNow, ChargeFailReason reason) = _canCharge(subscriptionId);

    if (!canChargeNow) {
      emit PaymentFailed(subscriptionId, uint8(reason));
      return false;
    }

    return _chargeSubscription(subscriptionId);
  }

  /**
   * @notice Batch execute charges
   * @param _subscriptionIds Subscription ID list
   * @return results Execution results
   */
  function batchCharge(bytes32[] calldata _subscriptionIds) external nonReentrant returns (bool[] memory results) {
    require(_subscriptionIds.length <= MAX_BATCH_SIZE, "Batch too large");

    results = new bool[](_subscriptionIds.length);

    for (uint256 i = 0; i < _subscriptionIds.length; i++) {
      bytes32 subId = _subscriptionIds[i];

      if (subscriptions[subId].subscriber == address(0)) {
        results[i] = false;
        continue;
      }

      (bool canChargeNow,) = _canCharge(subId);

      if (canChargeNow) {
        results[i] = _chargeSubscription(subId);
      } else {
        results[i] = false;
      }
    }

    return results;
  }

  /**
   * @notice Check if subscription can be charged
   * @param subscriptionId Subscription ID
   */
  function canCharge(bytes32 subscriptionId) external view returns (bool canChargeNow, uint8 reason) {
    // Call internal function to check charge status
    ChargeFailReason failReason;
    (canChargeNow, failReason) = _canCharge(subscriptionId);
    return (canChargeNow, uint8(failReason));
  }

  /**
   * @notice Internal charge check
   */
  function _canCharge(bytes32 subscriptionId) internal view returns (bool, ChargeFailReason) {
    Subscription storage sub = subscriptions[subscriptionId];
    Plan storage plan = plans[sub.planId];

    // Check plan status
    if (!plan.active) {
      return (false, ChargeFailReason.PlanInactive);
    }

    // Check subscription status
    if (sub.status == SubscriptionStatus.Canceled) {
      return (false, ChargeFailReason.Canceled);
    }
    if (sub.status == SubscriptionStatus.Paused) {
      return (false, ChargeFailReason.Paused);
    }

    // Check if due
    if (block.timestamp < sub.currentPeriodEnd) {
      return (false, ChargeFailReason.NotDue);
    }

    // Check balance and allowance
    if (plan.token == address(0)) {
      // Native token - cannot check balance (user needs to send during charge)
      return (true, ChargeFailReason.Success);
    } else {
      IBEP20 token = IBEP20(plan.token);
      uint256 balance = token.balanceOf(sub.subscriber);
      uint256 allowance = token.allowance(sub.subscriber, address(this));

      if (balance < plan.amount) {
        return (false, ChargeFailReason.InsufficientBalance);
      }
      if (allowance < plan.amount) {
        return (false, ChargeFailReason.NotApproved);
      }
    }

    return (true, ChargeFailReason.Success);
  }

  /**
   * @notice Execute subscription charge
   */
  function _chargeSubscription(bytes32 subscriptionId) internal returns (bool) {
    Subscription storage sub = subscriptions[subscriptionId];
    Plan storage plan = plans[sub.planId];

    // Check if should cancel at period end
    if (sub.cancelAtPeriodEnd) {
      uint8 oldStatus = uint8(sub.status);
      sub.status = SubscriptionStatus.Canceled;
      emit SubscriptionStatusChanged(subscriptionId, oldStatus, uint8(SubscriptionStatus.Canceled));
      return false;
    }

    // Execute charge
    bool paymentSuccess = _executePaymentFrom(plan, sub.subscriber);

    if (!paymentSuccess) {
      // Mark as expired
      uint8 oldStatus = uint8(sub.status);
      sub.status = SubscriptionStatus.Expired;
      emit SubscriptionStatusChanged(subscriptionId, oldStatus, uint8(SubscriptionStatus.Expired));
      emit PaymentFailed(subscriptionId, uint8(ChargeFailReason.InsufficientBalance));
      return false;
    }

    // Update period
    uint256 newPeriodStart = sub.currentPeriodEnd;
    uint256 newPeriodEnd = newPeriodStart + plan.interval;

    sub.currentPeriodStart = newPeriodStart;
    sub.currentPeriodEnd = newPeriodEnd;
    sub.paymentCount++;

    // Record payment history
    subscriptionPayments[subscriptionId].push(
      PaymentRecord({
        amount: plan.amount, timestamp: block.timestamp, periodStart: newPeriodStart, periodEnd: newPeriodEnd
      })
    );

    emit PaymentExecuted(subscriptionId, plan.amount, block.timestamp, newPeriodStart, newPeriodEnd);

    return true;
  }

  /**
   * @notice Execute payment (used for initial subscription)
   */
  function _executePayment(Plan storage plan, address payer) internal {
    if (plan.token == address(0)) {
      // Native token
      require(msg.value >= plan.amount, "Insufficient payment");

      // Transfer to merchant
      (bool success,) = plan.merchant.call{value: plan.amount}("");
      require(success, "Transfer failed");

      // Refund excess amount
      if (msg.value > plan.amount) {
        (bool refundSuccess,) = payer.call{value: msg.value - plan.amount}("");
        require(refundSuccess, "Refund failed");
      }
    } else {
      // ERC20 token
      IBEP20(plan.token).safeTransferFrom(payer, plan.merchant, plan.amount);
    }
  }

  /**
   * @notice Execute payment (used for renewal charges)
   */
  function _executePaymentFrom(Plan storage plan, address payer) internal returns (bool) {
    if (plan.token == address(0)) {
      // Native token - renewal requires user to call and pay manually
      // Return false to indicate user needs to renew manually
      return false;
    } else {
      // ERC20 token - can charge directly
      try IBEP20(plan.token).transferFrom(payer, plan.merchant, plan.amount) returns (bool success) {
        return success;
      } catch {
        return false;
      }
    }
  }

  /**
   * @notice Get all pending charges
   * @param offset Offset
   * @param limit Limit
   */
  function getPendingCharges(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory result, uint256 total)
  {
    // First calculate pending charge count
    uint256 count = 0;
    for (uint256 i = 0; i < subscriptionIds.length; i++) {
      (bool canChargeNow,) = _canCharge(subscriptionIds[i]);
      if (canChargeNow) {
        count++;
      }
    }
    total = count;

    if (offset >= total || limit == 0) {
      return (new bytes32[](0), total);
    }

    // Collect pending charge subscriptions
    uint256 resultSize = limit;
    if (offset + limit > total) {
      resultSize = total - offset;
    }

    result = new bytes32[](resultSize);
    uint256 found = 0;
    uint256 added = 0;

    for (uint256 i = 0; i < subscriptionIds.length && added < resultSize; i++) {
      (bool canChargeNow,) = _canCharge(subscriptionIds[i]);
      if (canChargeNow) {
        if (found >= offset) {
          result[added] = subscriptionIds[i];
          added++;
        }
        found++;
      }
    }

    return (result, total);
  }

  /**
   * @notice Get subscription payment history
   * @param subscriptionId Subscription ID
   * @param offset Offset
   * @param limit Limit
   */
  function getPaymentHistory(bytes32 subscriptionId, uint256 offset, uint256 limit)
    external
    view
    returns (uint256[] memory amounts, uint256[] memory timestamps, uint256 total)
  {
    PaymentRecord[] storage records = subscriptionPayments[subscriptionId];
    total = records.length;

    if (offset >= total || limit == 0) {
      return (new uint256[](0), new uint256[](0), total);
    }

    uint256 end = offset + limit;
    if (end > total) {
      end = total;
    }

    uint256 size = end - offset;
    amounts = new uint256[](size);
    timestamps = new uint256[](size);

    for (uint256 i = 0; i < size; i++) {
      PaymentRecord storage record = records[offset + i];
      amounts[i] = record.amount;
      timestamps[i] = record.timestamp;
    }

    return (amounts, timestamps, total);
  }

  // ============================================================================
  // Refund
  // ============================================================================

  /**
   * @notice Merchant refunds to user
   * @param subscriptionId Subscription ID
   * @param amount Refund amount
   * @param to Refund address
   */
  function refund(bytes32 subscriptionId, uint256 amount, address to)
    external
    payable
    nonReentrant
    requireSubscriptionExists(subscriptionId)
  {
    Subscription storage sub = subscriptions[subscriptionId];
    Plan storage plan = plans[sub.planId];

    require(msg.sender == plan.merchant, "Only merchant can refund");
    require(amount > 0, "Amount must be positive");

    address recipient = to == address(0) ? sub.subscriber : to;

    if (plan.token == address(0)) {
      // Native token refund
      require(msg.value >= amount, "Insufficient refund amount");
      (bool success,) = recipient.call{value: amount}("");
      require(success, "Refund failed");

      // Return excess amount
      if (msg.value > amount) {
        (bool refundSuccess,) = msg.sender.call{value: msg.value - amount}("");
        require(refundSuccess, "Return excess failed");
      }
    } else {
      // ERC20 token refund
      IBEP20(plan.token).safeTransferFrom(msg.sender, recipient, amount);
    }

    emit Refunded(subscriptionId, recipient, amount);
  }

  // ============================================================================
  // One-time Payment
  // ============================================================================

  /**
   * @notice One-time payment
   * @param orderId Order ID
   * @param amount Amount
   * @param token Token address
   * @param merchant Merchant address
   */
  function pay(bytes32 orderId, uint256 amount, address token, address merchant)
    external
    payable
    whenNotPaused
    nonReentrant
  {
    require(payments[orderId].payer == address(0), "Order already paid");
    require(amount > 0, "Amount must be positive");
    require(merchant != address(0), "Invalid merchant");
    require(tokenSupported[token], "Token not supported");

    if (token == address(0)) {
      // Native token
      require(msg.value >= amount, "Insufficient payment");

      (bool success,) = merchant.call{value: amount}("");
      require(success, "Transfer failed");

      // Refund excess amount
      if (msg.value > amount) {
        (bool refundSuccess,) = msg.sender.call{value: msg.value - amount}("");
        require(refundSuccess, "Refund failed");
      }
    } else {
      // ERC20 token
      IBEP20(token).safeTransferFrom(msg.sender, merchant, amount);
    }

    // Record payment
    payments[orderId] = Payment({
      orderId: orderId,
      payer: msg.sender,
      merchant: merchant,
      amount: amount,
      token: token,
      timestamp: block.timestamp,
      paid: true
    });

    emit PaymentReceived(orderId, msg.sender, merchant, amount, token);
  }

  /**
   * @notice Query one-time payment status
   * @param orderId Order ID
   */
  function getPayment(bytes32 orderId)
    external
    view
    returns (bool paid, address payer, address merchant, uint256 amount, address token, uint256 timestamp)
  {
    Payment storage p = payments[orderId];
    return (p.paid, p.payer, p.merchant, p.amount, p.token, p.timestamp);
  }

  // ============================================================================
  // Query Functions
  // ============================================================================

  /**
   * @notice Get contract version
   */
  function version() external pure returns (string memory) {
    return VERSION;
  }

  /**
   * @notice Get supported tokens list
   */
  function getSupportedTokens() external view returns (address[] memory) {
    return supportedTokens;
  }

  /**
   * @notice Check if token is supported
   * @param token Token address
   */
  function isTokenSupported(address token) external view returns (bool) {
    return tokenSupported[token];
  }

  /**
   * @notice Get total plan count
   */
  function getPlanCount() external view returns (uint256) {
    return planIds.length;
  }

  /**
   * @notice Get total subscription count
   */
  function getSubscriptionCount() external view returns (uint256) {
    return subscriptionIds.length;
  }

  // ============================================================================
  // Emergency Functions
  // ============================================================================

  /**
   * @notice Emergency withdraw stuck tokens (Owner only)
   * @param token Token address
   * @param to Recipient address
   * @param amount Amount
   */
  function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
    require(to != address(0), "Invalid recipient");

    if (token == address(0)) {
      (bool success,) = to.call{value: amount}("");
      require(success, "Transfer failed");
    } else {
      IBEP20(token).safeTransfer(to, amount);
    }
  }

  /**
   * @notice Receive native token
   */
  receive() external payable {}
}
