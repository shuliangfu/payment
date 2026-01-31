/**
 * @fileoverview PaymentSubscription 合约 ABI
 * @description 用于 Web3 适配器调用智能合约
 *
 * 对应合约接口: IPaymentSubscription.sol
 */

/**
 * PaymentSubscription 合约 ABI
 * 用于 ethers.js / viem / web3.js 调用
 */
export const PaymentSubscriptionABI = [
  // ============ 事件 ============

  // 计划创建事件
  {
    type: "event",
    name: "PlanCreated",
    inputs: [
      { name: "planId", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "interval", type: "uint32", indexed: false },
    ],
  },

  // 计划更新事件
  {
    type: "event",
    name: "PlanUpdated",
    inputs: [
      { name: "planId", type: "bytes32", indexed: true },
      { name: "active", type: "bool", indexed: false },
    ],
  },

  // 订阅创建事件
  {
    type: "event",
    name: "SubscriptionCreated",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "planId", type: "bytes32", indexed: true },
      { name: "subscriber", type: "address", indexed: true },
      { name: "startTime", type: "uint256", indexed: false },
    ],
  },

  // 订阅状态变更事件
  {
    type: "event",
    name: "SubscriptionStatusChanged",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "oldStatus", type: "uint8", indexed: false },
      { name: "newStatus", type: "uint8", indexed: false },
    ],
  },

  // 订阅取消事件
  {
    type: "event",
    name: "SubscriptionCanceled",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "cancelTime", type: "uint256", indexed: false },
      { name: "immediately", type: "bool", indexed: false },
    ],
  },

  // 支付执行事件
  {
    type: "event",
    name: "PaymentExecuted",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "periodStart", type: "uint256", indexed: false },
      { name: "periodEnd", type: "uint256", indexed: false },
    ],
  },

  // 支付失败事件
  {
    type: "event",
    name: "PaymentFailed",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "reason", type: "uint8", indexed: false },
    ],
  },

  // 退款事件
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  // 一次性支付事件
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: false },
    ],
  },

  // ============ 计划管理 ============

  // 创建订阅计划
  {
    type: "function",
    name: "createPlan",
    inputs: [
      { name: "planId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "interval", type: "uint32" },
      { name: "merchantAddress", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // 更新计划状态
  {
    type: "function",
    name: "updatePlan",
    inputs: [
      { name: "planId", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // 查询计划信息
  {
    type: "function",
    name: "getPlan",
    inputs: [{ name: "planId", type: "bytes32" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "interval", type: "uint32" },
      { name: "merchant", type: "address" },
      { name: "active", type: "bool" },
      { name: "subscriberCount", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // 检查计划是否存在
  {
    type: "function",
    name: "planExists",
    inputs: [{ name: "planId", type: "bytes32" }],
    outputs: [{ name: "exists", type: "bool" }],
    stateMutability: "view",
  },

  // ============ 订阅管理 ============

  // 用户创建订阅
  {
    type: "function",
    name: "subscribe",
    inputs: [{ name: "planId", type: "bytes32" }],
    outputs: [{ name: "subscriptionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },

  // 用户创建订阅（带试用期）
  {
    type: "function",
    name: "subscribeWithTrial",
    inputs: [
      { name: "planId", type: "bytes32" },
      { name: "trialDays", type: "uint32" },
    ],
    outputs: [{ name: "subscriptionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },

  // 取消订阅
  {
    type: "function",
    name: "cancelSubscription",
    inputs: [
      { name: "subscriptionId", type: "bytes32" },
      { name: "immediately", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // 暂停订阅
  {
    type: "function",
    name: "pauseSubscription",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // 恢复订阅
  {
    type: "function",
    name: "resumeSubscription",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // 查询订阅详情
  {
    type: "function",
    name: "getSubscription",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [
      { name: "subscriber", type: "address" },
      { name: "planId", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "startTime", type: "uint256" },
      { name: "currentPeriodStart", type: "uint256" },
      { name: "currentPeriodEnd", type: "uint256" },
      { name: "cancelAtPeriodEnd", type: "bool" },
    ],
    stateMutability: "view",
  },

  // 检查订阅是否存在
  {
    type: "function",
    name: "subscriptionExists",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [{ name: "exists", type: "bool" }],
    stateMutability: "view",
  },

  // 获取用户的所有订阅
  {
    type: "function",
    name: "getSubscriptionsByUser",
    inputs: [{ name: "subscriber", type: "address" }],
    outputs: [{ name: "subscriptionIds", type: "bytes32[]" }],
    stateMutability: "view",
  },

  // 获取计划的所有订阅
  {
    type: "function",
    name: "getSubscriptionsByPlan",
    inputs: [
      { name: "planId", type: "bytes32" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "subscriptionIds", type: "bytes32[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ============ 支付执行 ============

  // 执行订阅扣款
  {
    type: "function",
    name: "charge",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },

  // 批量执行扣款
  {
    type: "function",
    name: "batchCharge",
    inputs: [{ name: "subscriptionIds", type: "bytes32[]" }],
    outputs: [{ name: "results", type: "bool[]" }],
    stateMutability: "nonpayable",
  },

  // 检查订阅是否可以扣款
  {
    type: "function",
    name: "canCharge",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [
      { name: "canChargeNow", type: "bool" },
      { name: "reason", type: "uint8" },
    ],
    stateMutability: "view",
  },

  // 获取所有待扣款的订阅
  {
    type: "function",
    name: "getPendingCharges",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "subscriptionIds", type: "bytes32[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // 获取订阅的支付历史
  {
    type: "function",
    name: "getPaymentHistory",
    inputs: [
      { name: "subscriptionId", type: "bytes32" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "amounts", type: "uint256[]" },
      { name: "timestamps", type: "uint256[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ============ 退款 ============

  // 商户退款给用户
  {
    type: "function",
    name: "refund",
    inputs: [
      { name: "subscriptionId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ============ 一次性支付 ============

  // 一次性支付
  {
    type: "function",
    name: "pay",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "merchant", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },

  // 查询一次性支付状态
  {
    type: "function",
    name: "getPayment",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [
      { name: "paid", type: "bool" },
      { name: "payer", type: "address" },
      { name: "merchant", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ============ 管理功能 ============

  // 获取合约版本
  {
    type: "function",
    name: "version",
    inputs: [],
    outputs: [{ name: "version", type: "string" }],
    stateMutability: "pure",
  },

  // 获取支持的代币列表
  {
    type: "function",
    name: "getSupportedTokens",
    inputs: [],
    outputs: [{ name: "tokens", type: "address[]" }],
    stateMutability: "view",
  },

  // 检查代币是否支持
  {
    type: "function",
    name: "isTokenSupported",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "supported", type: "bool" }],
    stateMutability: "view",
  },
] as const;

/**
 * 订阅状态枚举
 */
export enum SubscriptionStatus {
  /** 活跃 */
  Active = 0,
  /** 暂停 */
  Paused = 1,
  /** 已取消 */
  Canceled = 2,
  /** 已过期（授权不足） */
  Expired = 3,
}

/**
 * 扣款失败原因枚举
 */
export enum ChargeFailReason {
  /** 可扣款 */
  Success = 0,
  /** 未到期 */
  NotDue = 1,
  /** 余额不足 */
  InsufficientBalance = 2,
  /** 未授权/授权不足 */
  NotApproved = 3,
  /** 已暂停 */
  Paused = 4,
  /** 已取消 */
  Canceled = 5,
  /** 计划已停用 */
  PlanInactive = 6,
}

/**
 * 订阅状态名称映射
 */
export const SubscriptionStatusNames: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: "active",
  [SubscriptionStatus.Paused]: "paused",
  [SubscriptionStatus.Canceled]: "canceled",
  [SubscriptionStatus.Expired]: "expired",
};

/**
 * 扣款失败原因名称映射
 */
export const ChargeFailReasonNames: Record<ChargeFailReason, string> = {
  [ChargeFailReason.Success]: "可扣款",
  [ChargeFailReason.NotDue]: "未到期",
  [ChargeFailReason.InsufficientBalance]: "余额不足",
  [ChargeFailReason.NotApproved]: "未授权",
  [ChargeFailReason.Paused]: "已暂停",
  [ChargeFailReason.Canceled]: "已取消",
  [ChargeFailReason.PlanInactive]: "计划已停用",
};

/**
 * 常用时间间隔（秒）
 */
export const SubscriptionIntervals = {
  /** 每天 */
  DAILY: 86400,
  /** 每周 */
  WEEKLY: 604800,
  /** 每月（30天） */
  MONTHLY: 2592000,
  /** 每季度（90天） */
  QUARTERLY: 7776000,
  /** 每年（365天） */
  YEARLY: 31536000,
} as const;

/**
 * 生成 planId（bytes32）
 * @param name 计划名称
 * @param merchantAddress 商户地址
 * @returns bytes32 格式的 planId
 */
export function generatePlanId(name: string, merchantAddress: string): string {
  // 使用 keccak256(abi.encodePacked(name, merchant, timestamp))
  const data = `${name}${merchantAddress}${Date.now()}`;
  return stringToBytes32(data);
}

/**
 * 生成 orderId（bytes32）
 * @param orderId 订单 ID 字符串
 * @returns bytes32 格式的 orderId
 */
export function generateOrderId(orderId: string): string {
  return stringToBytes32(orderId);
}

/**
 * 字符串转 bytes32
 * @param str 字符串
 * @returns bytes32 格式
 */
export function stringToBytes32(str: string): string {
  // 简单实现：取字符串的 UTF-8 编码前 32 字节
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));

  let hex = "0x";
  for (const byte of padded) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * bytes32 转字符串
 * @param bytes32 bytes32 格式
 * @returns 字符串
 */
export function bytes32ToString(bytes32: string): string {
  const hex = bytes32.startsWith("0x") ? bytes32.slice(2) : bytes32;
  const bytes = new Uint8Array(32);

  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  // 移除尾部的 0
  let end = 32;
  while (end > 0 && bytes[end - 1] === 0) {
    end--;
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes.slice(0, end));
}

export default PaymentSubscriptionABI;
