/**
 * @module @dreamer/plugins/payment/adapters/alipay
 *
 * 支付宝支付适配器
 *
 * 提供支付宝支付集成，支持：
 * - 电脑网站支付
 * - 手机网站支付
 * - APP 支付
 * - 扫码支付
 * - 退款处理
 * - 交易查询
 *
 * @see https://opendocs.alipay.com/open/203/105286
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
import {
  signAlipayParams,
  verifyAlipaySignature,
  formatAlipayDate,
} from "../crypto.ts";

/**
 * 支付宝配置选项
 */
export interface AlipayConfig {
  /** 应用 ID */
  appId: string;
  /** 应用私钥 */
  privateKey: string;
  /** 支付宝公钥 */
  alipayPublicKey: string;
  /** 签名类型 */
  signType?: "RSA2" | "RSA";
  /** 网关地址 */
  gateway?: string;
  /** 异步通知地址 */
  notifyUrl?: string;
  /** 同步返回地址 */
  returnUrl?: string;
  /** 是否为沙箱环境 */
  sandbox?: boolean;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * 支付宝网关地址
 */
const ALIPAY_GATEWAYS = {
  production: "https://openapi.alipay.com/gateway.do",
  sandbox: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
};

/**
 * 获取当前时间字符串
 */
function getTimestamp(): string {
  return formatAlipayDate(new Date());
}

/**
 * 创建支付宝适配器
 *
 * @param config - 支付宝配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createAlipayAdapter } from "@dreamer/plugins/payment/adapters/alipay";
 *
 * const alipay = createAlipayAdapter({
 *   appId: "2021000000000000",
 *   privateKey: "...",
 *   alipayPublicKey: "...",
 *   sandbox: true,
 * });
 *
 * // 创建支付
 * const result = await alipay.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "CNY",
 * });
 * ```
 */
export function createAlipayAdapter(config: AlipayConfig): PaymentAdapter {
  const {
    appId,
    privateKey,
    alipayPublicKey,
    signType = "RSA2",
    notifyUrl,
    returnUrl,
    sandbox = false,
    logging = {},
  } = config;

  const gateway = config.gateway ||
    (sandbox ? ALIPAY_GATEWAYS.sandbox : ALIPAY_GATEWAYS.production);

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "Alipay",
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
   * 对参数进行签名（异步版本）
   *
   * 使用 RSA-SHA256 对参数进行签名
   *
   * @param params - 请求参数
   * @returns Base64 编码的签名
   */
  const signParamsAsync = async (params: Record<string, string>): Promise<string> => {
    log("对参数进行签名", { paramCount: Object.keys(params).length });
    try {
      const signature = await signAlipayParams(params, privateKey);
      log("签名生成成功");
      return signature;
    } catch (error) {
      log("签名生成失败", error);
      throw error;
    }
  };

  /**
   * 验证支付宝返回的签名（异步版本）
   *
   * 使用支付宝公钥验证 RSA-SHA256 签名
   *
   * @param params - 回调参数
   * @returns 是否验证通过
   */
  const verifySignatureAsync = async (params: Record<string, string>): Promise<boolean> => {
    log("验证签名", { hasSign: !!params.sign });
    try {
      const isValid = await verifyAlipaySignature(params, alipayPublicKey);
      log("签名验证结果", { isValid });
      return isValid;
    } catch (error) {
      log("签名验证失败", error);
      return false;
    }
  };

  /**
   * 构建公共请求参数
   */
  const buildCommonParams = (method: string, bizContent: unknown): Record<string, string> => {
    return {
      app_id: appId,
      method,
      format: "JSON",
      charset: "utf-8",
      sign_type: signType,
      timestamp: getTimestamp(),
      version: "1.0",
      biz_content: JSON.stringify(bizContent),
    };
  };

  return {
    name: "alipay",
    version: "1.0.0",

    /**
     * 创建支付
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      log("创建支付宝支付", order);

      try {
        const amount = (order.amount / 100).toFixed(2); // 转换为元

        // 业务参数
        const bizContent = {
          out_trade_no: order.orderId,
          total_amount: amount,
          subject: order.productName || order.description || "商品",
          product_code: "FAST_INSTANT_TRADE_PAY", // 电脑网站支付
        };

        // 构建请求参数
        const params = buildCommonParams("alipay.trade.page.pay", bizContent);

        // 添加通知地址
        if (notifyUrl) {
          params["notify_url"] = notifyUrl;
        }
        if (returnUrl) {
          params["return_url"] = returnUrl;
        }

        // 签名（使用 RSA-SHA256）
        params["sign"] = await signParamsAsync(params);

        // 构建支付 URL
        const paymentUrl = `${gateway}?${
          Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join("&")
        }`;

        return {
          success: true,
          transactionId: `alipay_${order.orderId}`,
          paymentUrl,
          rawResponse: { params, gateway },
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建支付宝支付失败",
          errorCode: "ALIPAY_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      log("查询支付状态", transactionId);

      try {
        const outTradeNo = transactionId.replace("alipay_", "");

        // 构建查询参数
        const bizContent = {
          out_trade_no: outTradeNo,
        };

        const params = buildCommonParams("alipay.trade.query", bizContent);
        params["sign"] = await signParamsAsync(params);

        // 发送请求
        const response = await fetch(gateway, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join("&"),
        });

        const result = await response.json();
        const queryResponse = result.alipay_trade_query_response;

        log("查询结果", queryResponse);

        // 转换状态
        const statusMap: Record<string, PaymentStatusResponse["status"]> = {
          WAIT_BUYER_PAY: "pending",
          TRADE_CLOSED: "cancelled",
          TRADE_SUCCESS: "completed",
          TRADE_FINISHED: "completed",
        };

        if (queryResponse.code === "10000") {
          return {
            success: true,
            status: statusMap[queryResponse.trade_status] || "pending",
            paid: queryResponse.trade_status === "TRADE_SUCCESS" ||
              queryResponse.trade_status === "TRADE_FINISHED",
            transactionId: queryResponse.trade_no,
            amount: Math.round(parseFloat(queryResponse.total_amount) * 100),
            currency: "CNY",
            paidAt: queryResponse.send_pay_date
              ? new Date(queryResponse.send_pay_date)
              : undefined,
            rawResponse: queryResponse,
          };
        } else {
          return {
            success: false,
            status: "failed",
            paid: false,
            error: queryResponse.sub_msg || queryResponse.msg,
            rawResponse: queryResponse,
          };
        }
      } catch (error) {
        log("查询失败", error);
        return {
          success: false,
          status: "failed",
          paid: false,
          error: error instanceof Error ? error.message : "查询失败",
        };
      }
    },

    /**
     * 处理异步通知
     */
    async handleNotify(data: NotifyData): Promise<NotifyResponse> {
      log("处理支付宝通知", data.body);

      try {
        const params = data.body as Record<string, string>;

        // 验证签名（使用 RSA-SHA256）
        const isValid = await verifySignatureAsync(params);
        if (!isValid) {
          return {
            success: false,
            error: "签名验证失败",
            platformResponse: "fail",
          };
        }

        const tradeStatus = params.trade_status;
        const outTradeNo = params.out_trade_no;
        const tradeNo = params.trade_no;
        const totalAmount = params.total_amount;

        // 判断交易状态
        if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
          return {
            success: true,
            orderId: outTradeNo,
            transactionId: tradeNo,
            status: "completed",
            amount: Math.round(parseFloat(totalAmount) * 100),
            currency: "CNY",
            platformResponse: "success", // 支付宝要求返回 "success"
          };
        } else if (tradeStatus === "TRADE_CLOSED") {
          return {
            success: true,
            orderId: outTradeNo,
            transactionId: tradeNo,
            status: "cancelled",
            platformResponse: "success",
          };
        } else {
          // WAIT_BUYER_PAY 等状态
          return {
            success: true,
            orderId: outTradeNo,
            transactionId: tradeNo,
            status: "failed",
            platformResponse: "success",
          };
        }
      } catch (error) {
        log("处理通知失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理通知失败",
          platformResponse: "fail",
        };
      }
    },

    /**
     * 申请退款
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      log("申请退款", request);

      try {
        const bizContent: Record<string, unknown> = {
          trade_no: request.transactionId,
          refund_amount: ((request.amount || 0) / 100).toFixed(2),
          out_request_no: `refund_${Date.now()}`, // 退款请求号
        };

        if (request.reason) {
          bizContent["refund_reason"] = request.reason;
        }

        const params = buildCommonParams("alipay.trade.refund", bizContent);
        params["sign"] = await signParamsAsync(params);

        // 发送请求
        const response = await fetch(gateway, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join("&"),
        });

        const result = await response.json();
        const refundResponse = result.alipay_trade_refund_response;

        log("退款结果", refundResponse);

        if (refundResponse.code === "10000") {
          return {
            success: true,
            refundId: bizContent.out_request_no as string,
            status: "completed",
            rawResponse: refundResponse,
          };
        } else {
          return {
            success: false,
            error: refundResponse.sub_msg || refundResponse.msg,
            rawResponse: refundResponse,
          };
        }
      } catch (error) {
        log("退款失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "退款失败",
        };
      }
    },

    /**
     * 验证配置
     */
    validateConfig(): boolean {
      if (!appId) {
        log("配置验证失败：缺少 appId");
        return false;
      }
      if (!privateKey) {
        log("配置验证失败：缺少 privateKey");
        return false;
      }
      if (!alipayPublicKey) {
        log("配置验证失败：缺少 alipayPublicKey");
        return false;
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      return {
        appId,
        sandbox,
        gateway,
      };
    },
  };
}

// 导出默认工厂函数
export default createAlipayAdapter;
