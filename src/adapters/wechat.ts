/**
 * @module @dreamer/plugins/payment/adapters/wechat
 *
 * 微信支付适配器
 *
 * 提供微信支付集成，支持：
 * - Native 支付（扫码支付）
 * - JSAPI 支付（公众号/小程序）
 * - H5 支付
 * - APP 支付
 * - 退款处理
 * - 交易查询
 *
 * @see https://pay.weixin.qq.com/wiki/doc/apiv3/apis/index.shtml
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
  signWechatPayRequest,
  verifyWechatPaySignature,
  decryptWechatPayNotify,
  generateNonceStr as cryptoGenerateNonceStr,
  getTimestamp as cryptoGetTimestamp,
} from "../crypto.ts";

/**
 * 微信支付配置选项
 */
export interface WechatPayConfig {
  /** 商户号 */
  mchId: string;
  /** 商户 API 密钥（V3） */
  apiKey: string;
  /** 应用 ID（公众号/小程序/APP） */
  appId: string;
  /** 商户证书序列号 */
  serialNo?: string;
  /** 商户私钥 */
  privateKey?: string;
  /** 平台证书（用于验签） */
  platformCert?: string;
  /** 支付类型 */
  tradeType?: "NATIVE" | "JSAPI" | "H5" | "APP";
  /** 异步通知地址 */
  notifyUrl?: string;
  /** 是否为沙箱环境 */
  sandbox?: boolean;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * 微信支付 API 端点
 */
const WECHAT_PAY_ENDPOINTS = {
  production: "https://api.mch.weixin.qq.com",
  sandbox: "https://api.mch.weixin.qq.com/sandboxnew",
};

/**
 * 生成随机字符串
 */
function generateNonceStr(length = 32): string {
  return cryptoGenerateNonceStr(length);
}

/**
 * 获取当前时间戳（秒）
 */
function getTimestamp(): number {
  return cryptoGetTimestamp();
}

/**
 * 创建微信支付适配器
 *
 * @param config - 微信支付配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createWechatPayAdapter } from "@dreamer/plugins/payment/adapters/wechat";
 *
 * const wechatPay = createWechatPayAdapter({
 *   mchId: "1234567890",
 *   apiKey: "...",
 *   appId: "wx...",
 *   tradeType: "NATIVE",
 * });
 *
 * // 创建支付
 * const result = await wechatPay.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "CNY",
 * });
 * ```
 */
export function createWechatPayAdapter(config: WechatPayConfig): PaymentAdapter {
  const {
    mchId,
    apiKey,
    appId,
    serialNo,
    privateKey,
    platformCert,
    tradeType = "NATIVE",
    notifyUrl,
    sandbox = false,
    logging = {},
  } = config;

  const baseUrl = sandbox
    ? WECHAT_PAY_ENDPOINTS.sandbox
    : WECHAT_PAY_ENDPOINTS.production;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "WechatPay",
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
   * 生成签名（异步版本）
   *
   * 使用 RSA-SHA256 签名
   *
   * @param method - HTTP 方法
   * @param url - 请求 URL
   * @param timestamp - 时间戳
   * @param nonceStr - 随机字符串
   * @param body - 请求体
   * @returns Base64 编码的签名
   */
  const signRequestAsync = async (
    method: string,
    url: string,
    timestamp: number,
    nonceStr: string,
    body: string,
  ): Promise<string> => {
    if (!privateKey) {
      log("警告：未配置私钥，使用模拟签名");
      const signStr = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
      return btoa(signStr).slice(0, 64) + "_mock_signature";
    }

    try {
      const signature = await signWechatPayRequest(
        method,
        url,
        timestamp,
        nonceStr,
        body,
        privateKey,
      );
      log("签名生成成功");
      return signature;
    } catch (error) {
      log("签名生成失败", error);
      throw error;
    }
  };

  /**
   * 构建请求头（V3，异步版本）
   *
   * @param method - HTTP 方法
   * @param url - 请求 URL
   * @param body - 请求体
   * @returns Headers
   */
  const buildHeadersAsync = async (
    method: string,
    url: string,
    body: string,
  ): Promise<Headers> => {
    const timestamp = getTimestamp();
    const nonceStr = generateNonceStr();
    const signature = await signRequestAsync(method, url, timestamp, nonceStr, body);

    return new Headers({
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
    });
  };

  /**
   * 验证微信回调签名（异步版本）
   *
   * @param timestamp - Wechatpay-Timestamp 头
   * @param nonce - Wechatpay-Nonce 头
   * @param body - 请求体
   * @param signature - Wechatpay-Signature 头
   * @returns 是否验证通过
   */
  const verifyNotifySignatureAsync = async (
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
  ): Promise<boolean> => {
    if (!platformCert) {
      log("警告：未配置平台证书，跳过签名验证");
      return true;
    }

    try {
      const isValid = await verifyWechatPaySignature(
        timestamp,
        nonce,
        body,
        signature,
        platformCert,
      );
      log("回调签名验证结果", { isValid });
      return isValid;
    } catch (error) {
      log("回调签名验证失败", error);
      return false;
    }
  };

  /**
   * 解密回调数据（异步版本）
   *
   * 使用 AEAD_AES_256_GCM 算法
   *
   * @param ciphertext - Base64 编码的密文
   * @param associatedData - 附加数据
   * @param nonce - IV
   * @returns 解密后的数据对象
   */
  const decryptNotifyDataAsync = async (
    ciphertext: string,
    associatedData: string,
    nonce: string,
  ): Promise<unknown> => {
    log("解密回调数据", { ciphertext: ciphertext.slice(0, 20) + "..." });

    try {
      const decrypted = await decryptWechatPayNotify(
        ciphertext,
        associatedData,
        nonce,
        apiKey,
      );
      return JSON.parse(decrypted);
    } catch (error) {
      log("解密失败", error);
      throw error;
    }
  };

  /**
   * 获取交易类型对应的 API 路径
   */
  const getTradeApiPath = (): string => {
    switch (tradeType) {
      case "NATIVE":
        return "/v3/pay/transactions/native";
      case "JSAPI":
        return "/v3/pay/transactions/jsapi";
      case "H5":
        return "/v3/pay/transactions/h5";
      case "APP":
        return "/v3/pay/transactions/app";
      default:
        return "/v3/pay/transactions/native";
    }
  };

  return {
    name: "wechat",
    version: "1.0.0",

    /**
     * 创建支付
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      log("创建微信支付", order);

      try {
        const apiPath = getTradeApiPath();
        const requestBody: Record<string, unknown> = {
          mchid: mchId,
          appid: appId,
          description: order.productName || order.description || "商品",
          out_trade_no: order.orderId,
          notify_url: notifyUrl || order.callbackUrl,
          amount: {
            total: order.amount,
            currency: order.currency || "CNY",
          },
        };

        // JSAPI 支付需要 payer 信息
        if (tradeType === "JSAPI" && order.customer?.id) {
          requestBody["payer"] = {
            openid: order.customer.id,
          };
        }

        // H5 支付需要场景信息
        if (tradeType === "H5") {
          requestBody["scene_info"] = {
            payer_client_ip: "127.0.0.1",
            h5_info: {
              type: "Wap",
            },
          };
        }

        const body = JSON.stringify(requestBody);
        const headers = await buildHeadersAsync("POST", apiPath, body);

        log("请求参数", requestBody);

        // 发送请求
        const response = await fetch(`${baseUrl}${apiPath}`, {
          method: "POST",
          headers,
          body,
        });

        const result = (await response.json()) as {
          code_url?: string; // Native
          prepay_id?: string; // JSAPI/APP
          h5_url?: string; // H5
          code?: string;
          message?: string;
        };

        log("响应结果", result);

        if (!response.ok || result.code) {
          return {
            success: false,
            error: result.message || "创建微信支付失败",
            errorCode: result.code,
            rawResponse: result,
          };
        }

        // 根据交易类型返回不同的结果
        const paymentResponse: PaymentResponse = {
          success: true,
          transactionId: `wechat_${order.orderId}`,
          rawResponse: result,
        };

        if (result.code_url) {
          paymentResponse.qrCode = result.code_url;
        }
        if (result.h5_url) {
          paymentResponse.paymentUrl = result.h5_url;
        }
        if (result.prepay_id) {
          // JSAPI/APP 需要二次签名
          const timestamp = getTimestamp();
          const nonceStr = generateNonceStr();
          const packageStr = `prepay_id=${result.prepay_id}`;

          paymentResponse.paymentToken = JSON.stringify({
            appId,
            timeStamp: String(timestamp),
            nonceStr,
            package: packageStr,
            signType: "RSA",
            paySign: await signRequestAsync("", "", timestamp, nonceStr, packageStr),
          });
        }

        return paymentResponse;
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建微信支付失败",
          errorCode: "WECHAT_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      log("查询支付状态", transactionId);

      try {
        const outTradeNo = transactionId.replace("wechat_", "");
        const apiPath = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchId}`;
        const headers = await buildHeadersAsync("GET", apiPath, "");

        const response = await fetch(`${baseUrl}${apiPath}`, {
          method: "GET",
          headers,
        });

        const result = (await response.json()) as {
          transaction_id: string;
          trade_state: string;
          trade_state_desc: string;
          success_time?: string;
          amount: { total: number; currency: string };
          code?: string;
          message?: string;
        };

        log("查询结果", result);

        if (result.code) {
          return {
            success: false,
            status: "failed",
            paid: false,
            error: result.message,
            rawResponse: result,
          };
        }

        // 转换状态
        const statusMap: Record<string, PaymentStatusResponse["status"]> = {
          SUCCESS: "completed",
          REFUND: "refunded",
          NOTPAY: "pending",
          CLOSED: "cancelled",
          REVOKED: "cancelled",
          USERPAYING: "pending",
          PAYERROR: "failed",
        };

        return {
          success: true,
          status: statusMap[result.trade_state] || "pending",
          paid: result.trade_state === "SUCCESS",
          transactionId: result.transaction_id,
          amount: result.amount.total,
          currency: result.amount.currency,
          paidAt: result.success_time ? new Date(result.success_time) : undefined,
          rawResponse: result,
        };
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
     * 处理回调通知
     */
    async handleNotify(data: NotifyData): Promise<NotifyResponse> {
      log("处理微信支付回调", data.body);

      try {
        // 验证签名
        const timestamp = data.headers.get("Wechatpay-Timestamp") || "";
        const nonce = data.headers.get("Wechatpay-Nonce") || "";
        const signature = data.headers.get("Wechatpay-Signature") || "";
        const bodyStr = typeof data.body === "string"
          ? data.body
          : JSON.stringify(data.body);

        const isSignatureValid = await verifyNotifySignatureAsync(
          timestamp,
          nonce,
          bodyStr,
          signature,
        );
        if (!isSignatureValid) {
          return {
            success: false,
            error: "签名验证失败",
          };
        }

        // 解析回调数据
        const notifyData = data.body as {
          resource: {
            ciphertext: string;
            associated_data: string;
            nonce: string;
          };
        };

        // 解密数据（使用 AES-GCM）
        const decrypted = await decryptNotifyDataAsync(
          notifyData.resource.ciphertext,
          notifyData.resource.associated_data,
          notifyData.resource.nonce,
        ) as {
          out_trade_no: string;
          transaction_id: string;
          trade_state: string;
          amount: { total: number };
        };

        log("解密后数据", decrypted);

        if (decrypted.trade_state === "SUCCESS") {
          return {
            success: true,
            orderId: decrypted.out_trade_no,
            transactionId: decrypted.transaction_id,
            status: "completed",
            amount: decrypted.amount.total,
            currency: "CNY",
            platformResponse: JSON.stringify({ code: "SUCCESS", message: "成功" }),
          };
        } else {
          return {
            success: true,
            orderId: decrypted.out_trade_no,
            transactionId: decrypted.transaction_id,
            status: "failed",
            platformResponse: JSON.stringify({ code: "SUCCESS", message: "成功" }),
          };
        }
      } catch (error) {
        log("处理回调失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理回调失败",
          platformResponse: JSON.stringify({ code: "FAIL", message: "处理失败" }),
        };
      }
    },

    /**
     * 申请退款
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      log("申请退款", request);

      try {
        const apiPath = "/v3/refund/domestic/refunds";
        const requestBody = {
          transaction_id: request.transactionId,
          out_refund_no: `refund_${Date.now()}`,
          reason: request.reason,
          amount: {
            refund: request.amount || 0,
            total: request.amount || 0, // 实际应从原订单获取
            currency: "CNY",
          },
        };

        const body = JSON.stringify(requestBody);
        const headers = await buildHeadersAsync("POST", apiPath, body);

        const response = await fetch(`${baseUrl}${apiPath}`, {
          method: "POST",
          headers,
          body,
        });

        const result = (await response.json()) as {
          refund_id: string;
          status: string;
          code?: string;
          message?: string;
        };

        log("退款结果", result);

        if (result.code) {
          return {
            success: false,
            error: result.message,
            rawResponse: result,
          };
        }

        // 转换状态
        const statusMap: Record<string, RefundResponse["status"]> = {
          SUCCESS: "completed",
          CLOSED: "failed",
          PROCESSING: "pending",
          ABNORMAL: "failed",
        };

        return {
          success: true,
          refundId: result.refund_id,
          status: statusMap[result.status] || "pending",
          rawResponse: result,
        };
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
      if (!mchId) {
        log("配置验证失败：缺少 mchId");
        return false;
      }
      if (!apiKey) {
        log("配置验证失败：缺少 apiKey");
        return false;
      }
      if (!appId) {
        log("配置验证失败：缺少 appId");
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
        mchId,
        sandbox,
        tradeType,
      };
    },
  };
}

// 导出默认工厂函数
export default createWechatPayAdapter;
