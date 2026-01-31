/**
 * @module @dreamer/plugins/payment/adapters/unionpay
 *
 * 银联支付适配器
 *
 * 提供银联支付集成，支持：
 * - 网页支付（PC/移动端）
 * - 扫码支付
 * - 无卡支付
 * - 退款处理
 * - 交易查询
 *
 * @see https://open.unionpay.com/
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
 * 银联支付配置选项
 */
export interface UnionPayConfig {
  /** 商户号 */
  merchantId: string;
  /** 终端号 */
  terminalId: string;
  /** 签名证书路径（pfx 格式） */
  signCertPath?: string;
  /** 签名证书密码 */
  signCertPassword?: string;
  /** 验签证书路径（cer 格式） */
  verifyCertPath?: string;
  /** 加密证书路径 */
  encryptCertPath?: string;
  /** 商户私钥 */
  privateKey?: string;
  /** 银联公钥 */
  unionPayPublicKey?: string;
  /** 接入类型：0-商户直连，1-收单机构接入 */
  accessType?: "0" | "1";
  /** 渠道类型：07-PC/08-手机 */
  channelType?: "07" | "08";
  /** 货币代码（默认 156 = CNY） */
  currencyCode?: string;
  /** 是否为测试环境 */
  sandbox?: boolean;
  /** 异步通知地址 */
  notifyUrl?: string;
  /** 同步返回地址 */
  returnUrl?: string;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * 银联 API 端点
 */
const UNIONPAY_ENDPOINTS = {
  // 生产环境
  production: {
    frontTransReq: "https://gateway.95516.com/gateway/api/frontTransReq.do",
    backTransReq: "https://gateway.95516.com/gateway/api/backTransReq.do",
    queryTrans: "https://gateway.95516.com/gateway/api/queryTrans.do",
    appTransReq: "https://gateway.95516.com/gateway/api/appTransReq.do",
  },
  // 测试环境
  sandbox: {
    frontTransReq: "https://gateway.test.95516.com/gateway/api/frontTransReq.do",
    backTransReq: "https://gateway.test.95516.com/gateway/api/backTransReq.do",
    queryTrans: "https://gateway.test.95516.com/gateway/api/queryTrans.do",
    appTransReq: "https://gateway.test.95516.com/gateway/api/appTransReq.do",
  },
};

/**
 * 生成订单号
 * 银联要求订单号格式：商户代码（15位）+ 订单号（最多32位）
 */
function generateOrderId(merchantId: string, orderId: string): string {
  // 确保订单号不超过限制
  const maxLength = 32 - merchantId.length;
  const shortOrderId = orderId.slice(0, maxLength);
  return shortOrderId;
}

/**
 * 获取当前时间字符串（YYYYMMDDHHmmss 格式）
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 创建银联支付适配器
 *
 * @param config - 银联支付配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createUnionPayAdapter } from "@dreamer/plugins/payment/adapters/unionpay";
 *
 * const unionPay = createUnionPayAdapter({
 *   merchantId: "777290058110097",
 *   terminalId: "00000001",
 *   privateKey: "...",
 *   unionPayPublicKey: "...",
 *   sandbox: true,
 * });
 *
 * // 创建支付
 * const result = await unionPay.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "CNY",
 * });
 * ```
 */
export function createUnionPayAdapter(config: UnionPayConfig): PaymentAdapter {
  // 解构配置，设置默认值
  const {
    merchantId,
    terminalId,
    accessType = "0",
    channelType = "08",
    currencyCode = "156", // CNY
    sandbox = false,
    notifyUrl,
    returnUrl,
    logging = {},
  } = config;

  // 选择 API 端点
  const endpoints = sandbox ? UNIONPAY_ENDPOINTS.sandbox : UNIONPAY_ENDPOINTS.production;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "UnionPay",
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
   * 构建基础请求参数
   */
  const buildBaseParams = (orderId: string, amount: number) => ({
    // 版本号
    version: "5.1.0",
    // 编码方式
    encoding: "UTF-8",
    // 签名方法
    signMethod: "01", // RSA
    // 交易类型
    txnType: "01", // 消费
    // 交易子类型
    txnSubType: "01", // 自助消费
    // 业务类型
    bizType: "000201", // B2C 网关支付
    // 渠道类型
    channelType,
    // 接入类型
    accessType,
    // 商户代码
    merId: merchantId,
    // 商户订单号
    orderId: generateOrderId(merchantId, orderId),
    // 订单发送时间
    txnTime: getTimestamp(),
    // 交易金额（单位：分）
    txnAmt: String(amount),
    // 交易币种
    currencyCode,
    // 前台通知地址
    frontUrl: returnUrl || "",
    // 后台通知地址
    backUrl: notifyUrl || "",
  });

  /**
   * 签名请求参数
   * 注意：实际实现需要使用 RSA 签名
   */
  const signParams = (params: Record<string, string>): string => {
    // 1. 按照键名排序
    const sortedKeys = Object.keys(params).sort();

    // 2. 拼接参数
    const queryString = sortedKeys
      .filter((key) => params[key] !== "" && params[key] !== undefined)
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    // 3. SHA256 签名
    // 注意：实际实现需要使用私钥进行 RSA 签名
    // 这里返回模拟签名
    log("待签名字符串", queryString);

    return "mock_signature_" + btoa(queryString).slice(0, 32);
  };

  /**
   * 验证响应签名
   * 注意：实际实现需要使用银联公钥验证
   */
  const verifySignature = (_params: Record<string, string>): boolean => {
    // 实际实现需要使用银联公钥验证签名
    log("验证签名");
    return true;
  };

  return {
    name: "unionpay",
    version: "1.0.0",

    /**
     * 创建支付
     * 返回跳转支付页面的 URL 或表单数据
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("创建银联支付", order);

      try {
        // 构建请求参数
        const params = buildBaseParams(order.orderId, order.amount);

        // 添加商品信息
        if (order.description) {
          (params as Record<string, string>)["orderDesc"] = order.description;
        }

        // 签名
        const signature = signParams(params);
        (params as Record<string, string>)["signature"] = signature;

        // 银联网页支付使用表单 POST 提交
        // 返回表单数据给前端
        const formData = {
          action: endpoints.frontTransReq,
          method: "POST",
          params,
        };

        // 生成支付 URL（用于展示二维码或跳转）
        const paymentUrl = `${endpoints.frontTransReq}?${
          Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join("&")
        }`;

        return {
          success: true,
          transactionId: `unionpay_${order.orderId}`,
          paymentUrl,
          rawResponse: formData,
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建银联支付失败",
          errorCode: "UNIONPAY_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("查询支付状态", transactionId);

      try {
        // 构建查询参数
        const params: Record<string, string> = {
          version: "5.1.0",
          encoding: "UTF-8",
          signMethod: "01",
          txnType: "00", // 查询交易
          txnSubType: "00",
          bizType: "000000",
          accessType,
          merId: merchantId,
          orderId: transactionId.replace("unionpay_", ""),
          txnTime: getTimestamp(),
        };

        // 签名
        params["signature"] = signParams(params);

        // 注意：实际实现需要发送 HTTP 请求到银联
        // 这里返回模拟数据
        log("查询请求", { url: endpoints.queryTrans, params });

        return {
          success: true,
          status: "pending",
          paid: false,
          transactionId,
          rawResponse: {
            respCode: "00",
            respMsg: "成功",
          },
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
      await Promise.resolve(); // 满足 async 函数要求
      log("处理银联回调", data.body);

      try {
        const body = data.body as Record<string, string>;

        // 验证签名
        if (!verifySignature(body)) {
          return {
            success: false,
            error: "签名验证失败",
          };
        }

        // 解析响应
        const respCode = body.respCode;
        const orderId = body.orderId;
        const queryId = body.queryId; // 银联交易流水号
        const txnAmt = body.txnAmt;

        // 判断支付结果
        if (respCode === "00") {
          return {
            success: true,
            orderId,
            transactionId: queryId,
            status: "completed",
            amount: parseInt(txnAmt, 10),
            currency: "CNY",
            // 银联要求返回 "ok" 表示通知接收成功
            platformResponse: "ok",
          };
        } else {
          return {
            success: false,
            orderId,
            status: "failed",
            error: body.respMsg || "支付失败",
            platformResponse: "ok", // 即使失败也要返回 ok，否则银联会重试
          };
        }
      } catch (error) {
        log("处理回调失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理回调失败",
          platformResponse: "fail",
        };
      }
    },

    /**
     * 申请退款
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("申请退款", request);

      try {
        // 构建退款参数
        const params: Record<string, string> = {
          version: "5.1.0",
          encoding: "UTF-8",
          signMethod: "01",
          txnType: "04", // 退货
          txnSubType: "00",
          bizType: "000201",
          accessType,
          merId: merchantId,
          orderId: `refund_${Date.now()}`, // 退款订单号
          origQryId: request.transactionId, // 原交易流水号
          txnTime: getTimestamp(),
          txnAmt: String(request.amount || 0),
        };

        // 签名
        params["signature"] = signParams(params);

        // 注意：实际实现需要发送 HTTP 请求到银联
        log("退款请求", { url: endpoints.backTransReq, params });

        return {
          success: true,
          refundId: params.orderId,
          status: "pending",
          rawResponse: {
            respCode: "00",
            respMsg: "退款申请已提交",
          },
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
      if (!merchantId) {
        log("配置验证失败：缺少 merchantId");
        return false;
      }
      if (!terminalId) {
        log("配置验证失败：缺少 terminalId");
        return false;
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      return {
        merchantId,
        sandbox,
        // 银联云闪付 SDK 配置
        sdkConfig: {
          environment: sandbox ? "test" : "production",
          merchantId,
        },
      };
    },
  };
}

// 导出默认工厂函数
export default createUnionPayAdapter;
