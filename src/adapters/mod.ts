/**
 * @module @dreamer/payment/adapters
 *
 * 支付适配器集合
 *
 * 提供统一的支付适配器接口和多种支付方式实现
 */

// 导出 Stripe 适配器
export {
  createStripeAdapter,
  default as stripeAdapter,
  type StripeConfig,
} from "./stripe.ts";

// 导出 PayPal 适配器
export {
  createPayPalAdapter,
  default as paypalAdapter,
  type PayPalConfig,
} from "./paypal.ts";

// 导出支付宝适配器
export {
  createAlipayAdapter,
  default as alipayAdapter,
  type AlipayConfig,
} from "./alipay.ts";

// 导出微信支付适配器
export {
  createWechatPayAdapter,
  default as wechatPayAdapter,
  type WechatPayConfig,
} from "./wechat.ts";

// 导出 Apple Pay 适配器
export {
  createApplePayAdapter,
  default as applePayAdapter,
  type ApplePayConfig,
} from "./apple-pay.ts";

// 导出 Google Pay 适配器
export {
  createGooglePayAdapter,
  default as googlePayAdapter,
  type GooglePayConfig,
} from "./google-pay.ts";

// 导出银联支付适配器
export {
  createUnionPayAdapter,
  default as unionPayAdapter,
  type UnionPayConfig,
} from "./unionpay.ts";

// 导出 Web3 支付适配器
export {
  createWeb3Adapter,
  default as web3Adapter,
  type Web3ContractsConfig,
  type Web3Network,
  type Web3PayConfig,
  type Web3Token,
  // 二维码支付和链上监听
  createTransferWatcher,
  generatePaymentUri,
  type TransferEvent,
  type TransferWatcher,
  type WatchTransferConfig,
} from "./web3.ts";

// 导出 Web3 订阅合约 ABI（用于智能合约交互）
export {
  PaymentSubscriptionABI,
  SubscriptionStatus,
  ChargeFailReason,
  SubscriptionStatusNames,
  ChargeFailReasonNames,
  SubscriptionIntervals,
  generatePlanId,
  generateOrderId,
  stringToBytes32,
  bytes32ToString,
} from "./PaymentSubscriptionABI.ts";

import type { PaymentAdapter } from "../types.ts";
import { createStripeAdapter } from "./stripe.ts";
import { createPayPalAdapter } from "./paypal.ts";
import { createAlipayAdapter } from "./alipay.ts";
import { createWechatPayAdapter } from "./wechat.ts";
import { createApplePayAdapter } from "./apple-pay.ts";
import { createGooglePayAdapter } from "./google-pay.ts";
import { createUnionPayAdapter } from "./unionpay.ts";
import { createWeb3Adapter } from "./web3.ts";

/**
 * 支付适配器名称
 */
export type PaymentAdapterName =
  | "stripe"
  | "paypal"
  | "alipay"
  | "wechat"
  | "apple-pay"
  | "google-pay"
  | "unionpay"
  | "web3";

/**
 * 适配器配置类型映射
 */
export interface AdapterConfigMap {
  stripe: import("./stripe.ts").StripeConfig;
  paypal: import("./paypal.ts").PayPalConfig;
  alipay: import("./alipay.ts").AlipayConfig;
  wechat: import("./wechat.ts").WechatPayConfig;
  "apple-pay": import("./apple-pay.ts").ApplePayConfig;
  "google-pay": import("./google-pay.ts").GooglePayConfig;
  unionpay: import("./unionpay.ts").UnionPayConfig;
  web3: import("./web3.ts").Web3PayConfig;
}

/**
 * 适配器工厂函数映射
 */
const adapterFactories = {
  stripe: createStripeAdapter,
  paypal: createPayPalAdapter,
  alipay: createAlipayAdapter,
  wechat: createWechatPayAdapter,
  "apple-pay": createApplePayAdapter,
  "google-pay": createGooglePayAdapter,
  unionpay: createUnionPayAdapter,
  web3: createWeb3Adapter,
} as const;

/**
 * 创建支付适配器
 *
 * 工厂函数，根据名称创建对应的支付适配器
 *
 * @param name - 适配器名称
 * @param config - 适配器配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createAdapter } from "@dreamer/payment";
 *
 * const stripe = createAdapter("stripe", {
 *   publicKey: "pk_test_xxx",
 *   secretKey: "sk_test_xxx",
 * });
 * ```
 */
export function createAdapter<T extends PaymentAdapterName>(
  name: T,
  config: AdapterConfigMap[T],
): PaymentAdapter {
  const factory = adapterFactories[name];
  if (!factory) {
    throw new Error(`未知的支付适配器: ${name}`);
  }
  // @ts-ignore - 类型已通过泛型约束
  return factory(config);
}

/**
 * 获取所有支持的适配器名称
 */
export function getSupportedAdapters(): PaymentAdapterName[] {
  return Object.keys(adapterFactories) as PaymentAdapterName[];
}
