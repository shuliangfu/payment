/**
 * @module @dreamer/payment
 *
 * 统一支付库
 *
 * 提供统一的支付功能集成，支持多种支付方式：
 *
 * ## 国际支付
 * - **Stripe** - 全球领先的支付处理器
 * - **PayPal** - 全球最大的在线支付平台
 * - **Apple Pay** - Apple 设备一键支付
 * - **Google Pay** - Google 移动支付
 *
 * ## 国内支付
 * - **Alipay** - 支付宝支付
 * - **WechatPay** - 微信支付
 * - **UnionPay** - 银联支付
 *
 * ## Web3 支付
 * - **Web3** - 加密货币支付（ETH、USDT 等）
 *
 * @example
 * ```typescript
 * import { createStripeAdapter, createAlipayAdapter } from "@dreamer/payment";
 *
 * // 创建 Stripe 适配器
 * const stripe = createStripeAdapter({
 *   publicKey: "pk_test_xxx",
 *   secretKey: "sk_test_xxx",
 * });
 *
 * // 创建支付
 * const result = await stripe.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "USD",
 * });
 * ```
 */

// 导出类型定义
export type {
  // 基础类型
  Logger,
  LoggerOptions,
  LogLevel,
  NotifyData,
  NotifyResponse,
  PaymentAdapter,
  PaymentAdapterFactory,
  PaymentOrderInfo,
  PaymentResponse,
  PaymentStatusResponse,
  RefundRequest,
  RefundResponse,
  // 订阅支付类型
  CreateSubscriptionRequest,
  Subscription,
  SubscriptionPaymentAdapter,
  SubscriptionPlan,
  SubscriptionResponse,
  // 货币转换类型
  CurrencyConversionRequest,
  CurrencyConversionResult,
  ExchangeRate,
  ExchangeRateProvider,
  // 对账类型
  ReconciliationRecord,
  ReconciliationResult,
  Reconciler,
  TransactionRecord,
} from "./types.ts";

export { createDefaultLogger } from "./types.ts";

// 导出所有适配器
export * from "./adapters/mod.ts";

// 导出货币转换工具
export {
  createCurrencyConverter,
  createExchangeRateApiProvider,
  createFixedRatesProvider,
  createOpenExchangeRatesProvider,
  CurrencyConverter,
  FIAT_CURRENCIES,
  formatCurrency,
} from "./currency.ts";

export type {
  CurrencyConverterConfig,
  ExchangeRateApiConfig,
  FixedRatesConfig,
  OpenExchangeRatesConfig,
} from "./currency.ts";

// 导出对账工具
export {
  createReconciler,
  InMemoryTransactionStore,
  PaymentReconciler,
  StripeTransactionFetcher,
} from "./reconciliation.ts";

export type {
  ReconcilerConfig,
  RemoteTransactionFetcher,
  TransactionStore,
} from "./reconciliation.ts";

// 导出加密工具
export {
  // HMAC 签名
  hmacSign,
  hmacVerify,
  timingSafeEqual,
  // Stripe Webhook 验证
  verifyStripeWebhook,
  // RSA 签名
  rsaSign,
  rsaVerify,
  importRSAPrivateKey,
  importRSAPublicKey,
  // 支付宝
  signAlipayParams,
  verifyAlipaySignature,
  formatAlipayDate,
  // 微信支付
  signWechatPayRequest,
  verifyWechatPaySignature,
  decryptWechatPayNotify,
  // 通用工具
  generateNonceStr,
  getTimestamp,
  generateRandomString,
  generateRandomBytes,
  hash,
} from "./crypto.ts";
