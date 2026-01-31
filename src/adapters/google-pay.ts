/**
 * @module @dreamer/plugins/payment/adapters/google-pay
 *
 * Google Pay 支付适配器
 *
 * 提供 Google Pay 支付集成，支持：
 * - 创建支付请求
 * - 处理支付回调
 * - 查询支付状态
 * - 退款处理
 *
 * 注意：Google Pay 需要配合支付处理器（如 Stripe、Braintree）使用
 *
 * @see https://developers.google.com/pay/api/web/overview
 */

import {
  createDefaultLogger,
  type Logger,
  type LoggerOptions,
  type NotifyData,
  type NotifyResponse,
  type PaymentAdapter,
  type PaymentOrderInfo,
  type PaymentResponse,
  type PaymentStatusResponse,
  type RefundRequest,
  type RefundResponse,
} from "../types.ts";

/**
 * Google Pay 配置选项
 */
export interface GooglePayConfig {
  /** 商户 ID（Google Pay 商户中心配置） */
  merchantId: string;
  /** 商户名称 */
  merchantName: string;
  /** 网关类型（支付处理器） */
  gateway: "stripe" | "braintree" | "adyen" | "cybersource" | "example";
  /** 网关商户 ID */
  gatewayMerchantId: string;
  /** 支持的卡网络 */
  allowedCardNetworks?: ("AMEX" | "DISCOVER" | "INTERAC" | "JCB" | "MASTERCARD" | "VISA")[];
  /** 支持的认证方式 */
  allowedCardAuthMethods?: ("PAN_ONLY" | "CRYPTOGRAM_3DS")[];
  /** 国家代码 */
  countryCode?: string;
  /** 是否为测试环境 */
  environment?: "TEST" | "PRODUCTION";
  /** 是否需要邮寄地址 */
  shippingAddressRequired?: boolean;
  /** 是否需要邮箱 */
  emailRequired?: boolean;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * 创建 Google Pay 适配器
 *
 * @param config - Google Pay 配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createGooglePayAdapter } from "@dreamer/plugins/payment/adapters/google-pay";
 *
 * const googlePay = createGooglePayAdapter({
 *   merchantId: "12345678901234567890",
 *   merchantName: "Example Store",
 *   gateway: "stripe",
 *   gatewayMerchantId: "acct_xxx",
 *   environment: "TEST",
 * });
 *
 * // 创建支付
 * const result = await googlePay.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "USD",
 * });
 * ```
 */
export function createGooglePayAdapter(config: GooglePayConfig): PaymentAdapter {
  // 解构配置，设置默认值
  const {
    merchantId,
    merchantName,
    gateway,
    gatewayMerchantId,
    allowedCardNetworks = ["AMEX", "DISCOVER", "MASTERCARD", "VISA"],
    allowedCardAuthMethods = ["PAN_ONLY", "CRYPTOGRAM_3DS"],
    countryCode = "US",
    environment = "TEST",
    shippingAddressRequired = false,
    emailRequired = false,
    logging = {},
  } = config;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "GooglePay",
    logger: customLogger,
  } = logging;

  // 创建日志器
  const logger: Logger = customLogger || createDefaultLogger({
    enabled: logEnabled,
    level: logLevel,
    prefix: logPrefix,
  });

  /**
   * 日志输出
   */
  const log = (message: string, data?: unknown) => {
    if (logEnabled) {
      logger.debug(`[${logPrefix}] ${message}`, data);
    }
  };

  /**
   * 构建基础请求配置
   */
  const buildBaseRequest = () => ({
    apiVersion: 2,
    apiVersionMinor: 0,
  });

  /**
   * 构建卡支付方式配置
   */
  const buildCardPaymentMethod = () => ({
    type: "CARD",
    parameters: {
      allowedAuthMethods: allowedCardAuthMethods,
      allowedCardNetworks: allowedCardNetworks,
    },
    tokenizationSpecification: {
      type: "PAYMENT_GATEWAY",
      parameters: {
        gateway: gateway,
        gatewayMerchantId: gatewayMerchantId,
      },
    },
  });

  /**
   * 构建商户信息
   */
  const buildMerchantInfo = () => ({
    merchantId: environment === "PRODUCTION" ? merchantId : undefined,
    merchantName: merchantName,
  });

  return {
    name: "google-pay",
    version: "1.0.0",

    /**
     * 创建支付
     * 返回前端需要的 PaymentDataRequest 配置
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("创建 Google Pay 支付", order);

      try {
        // 构建 PaymentDataRequest
        const paymentDataRequest = {
          ...buildBaseRequest(),
          allowedPaymentMethods: [buildCardPaymentMethod()],
          transactionInfo: {
            totalPriceStatus: "FINAL",
            totalPrice: (order.amount / 100).toFixed(2), // 转换为元
            currencyCode: order.currency || "USD",
            countryCode: countryCode,
            transactionId: order.orderId,
          },
          merchantInfo: buildMerchantInfo(),
          shippingAddressRequired,
          emailRequired,
          callbackIntents: ["PAYMENT_AUTHORIZATION"],
        };

        // 生成支付 Token，前端用于初始化 Google Pay
        const paymentToken = btoa(JSON.stringify({
          orderId: order.orderId,
          environment,
          paymentDataRequest,
          timestamp: Date.now(),
        }));

        return {
          success: true,
          transactionId: `googlepay_${order.orderId}`,
          paymentToken,
          rawResponse: paymentDataRequest,
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建 Google Pay 支付失败",
          errorCode: "GOOGLE_PAY_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     * 注意：Google Pay 本身不提供查询接口，需要通过支付处理器查询
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("查询支付状态", transactionId);

      // Google Pay 的支付状态需要通过配合的支付处理器查询
      return {
        success: true,
        status: "pending",
        paid: false,
        transactionId,
        rawResponse: {
          note: "Google Pay 支付状态需要通过配合的支付处理器查询",
          gateway,
        },
      };
    },

    /**
     * 处理回调通知
     * 处理来自前端的支付完成通知（包含 Google Pay 的 payment data）
     */
    async handleNotify(data: NotifyData): Promise<NotifyResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("处理支付通知", data.body);

      try {
        const body = data.body as {
          orderId?: string;
          paymentData?: {
            paymentMethodData?: {
              tokenizationData?: {
                token?: string;
              };
              info?: {
                cardNetwork?: string;
                cardDetails?: string;
              };
            };
          };
          transactionId?: string;
        };

        if (!body.paymentData?.paymentMethodData?.tokenizationData?.token) {
          return {
            success: false,
            error: "缺少 payment token",
          };
        }

        // 解析 payment token
        const tokenData = body.paymentData.paymentMethodData.tokenizationData.token;
        log("收到 payment token", { tokenLength: tokenData.length });

        // 注意：实际实现需要将 token 发送给支付处理器进行验证和扣款
        const transactionId = body.transactionId ||
          `googlepay_${body.orderId}_${Date.now()}`;

        return {
          success: true,
          orderId: body.orderId,
          transactionId,
          status: "completed",
          platformResponse: JSON.stringify({ status: "ok" }),
        };
      } catch (error) {
        log("处理通知失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理通知失败",
        };
      }
    },

    /**
     * 申请退款
     * 注意：Google Pay 退款需要通过支付处理器完成
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("申请退款", request);

      // Google Pay 的退款需要通过配合的支付处理器完成
      return {
        success: false,
        error: `Google Pay 退款需要通过 ${gateway} 支付处理器完成`,
      };
    },

    /**
     * 验证配置
     */
    validateConfig(): boolean {
      if (!merchantId && environment === "PRODUCTION") {
        log("配置验证失败：生产环境需要 merchantId");
        return false;
      }
      if (!merchantName) {
        log("配置验证失败：缺少 merchantName");
        return false;
      }
      if (!gateway) {
        log("配置验证失败：缺少 gateway");
        return false;
      }
      if (!gatewayMerchantId) {
        log("配置验证失败：缺少 gatewayMerchantId");
        return false;
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      return {
        environment,
        merchantId: environment === "PRODUCTION" ? merchantId : undefined,
        merchantName,
        gateway,
        allowedCardNetworks,
        allowedCardAuthMethods,
        // 是否准备好支付的检查配置
        isReadyToPayRequest: {
          ...buildBaseRequest(),
          allowedPaymentMethods: [{
            type: "CARD",
            parameters: {
              allowedAuthMethods: allowedCardAuthMethods,
              allowedCardNetworks: allowedCardNetworks,
            },
          }],
        },
      };
    },
  };
}

// 导出默认工厂函数
export default createGooglePayAdapter;
