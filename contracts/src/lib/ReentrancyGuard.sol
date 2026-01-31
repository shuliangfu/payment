// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
  // Use uint256 instead of bool to save gas (avoid SSTORE operation)
  uint256 private constant _NOT_ENTERED = 1;
  uint256 private constant _ENTERED = 2;

  // General reentrancy protection state variable
  uint256 private _status;

  // Withdrawal reentrancy protection state variable
  uint256 private _withdrawStatus;

  constructor() {
    _status = _NOT_ENTERED;
    _withdrawStatus = _NOT_ENTERED;
  }

  /**
   * @dev General reentrancy protection modifier (recommended)
   * Used to protect any function that may be reentered
   */
  modifier nonReentrant() {
    _nonReentrantBefore();
    _;
    _nonReentrantAfter();
  }

  /**
   * @dev Withdrawal reentrancy protection modifier
   * Used to protect withdrawal-related functions
   */
  modifier nonReentrantWithdraw() {
    _nonReentrantWithdrawBefore();
    _;
    _nonReentrantWithdrawAfter();
  }

  /**
   * @dev General reentrancy protection pre-check
   */
  function _nonReentrantBefore() internal {
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
    _status = _ENTERED;
  }

  /**
   * @dev General reentrancy protection post-processing
   */
  function _nonReentrantAfter() internal {
    _status = _NOT_ENTERED;
  }

  /**
   * @dev Withdrawal reentrancy protection pre-check
   */
  function _nonReentrantWithdrawBefore() internal {
    require(_withdrawStatus != _ENTERED, "ReentrancyGuard: reentrant call");
    _withdrawStatus = _ENTERED;
  }

  /**
   * @dev Withdrawal reentrancy protection post-processing
   */
  function _nonReentrantWithdrawAfter() internal {
    _withdrawStatus = _NOT_ENTERED;
  }
}
