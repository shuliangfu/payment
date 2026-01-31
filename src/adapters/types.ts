/**
 * @module @dreamer/plugins/payment/adapters/types
 *
 * 支付适配器类型定义
 *
 * 提供统一的支付适配器接口，所有支付方式都需要实现这个接口。
 */

import type { Logger as DreamerLogger, LogLevel } from "@dreamer/logger";

/**
 * 日志器类型（可以是 @dreamer/logger 的 Logger 或简化接口）
 */
export type Logger = DreamerLogger | {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
};

/**
 * 日志配置
 */
export interface LoggerOptions {
  /** 是否启用日志（默认 false） */
  enabled?: boolean;
  /** 日志级别（默认 "info"） */
  level?: LogLevel;
  /** 日志标签前缀 */
  prefix?: string;
  /** 自定义日志器实例 */
  logger?: Logger;
}

export type { LogLevel };

/**
 * 支付订单信息
 */
export interface PaymentOrderInfo {
  /** 订单 ID */
  orderId: string;
  /** 金额（单位：分） */
  amount: number;
  /** 货币代码（如 "CNY", "USD"），默认根据适配器确定 */
  currency?: string;
  /** 订单描述 */
  description?: string;
  /** 商品名称 */
  productName?: string;
  /** 支付成功后回调 URL */
  callbackUrl?: string;
  /** 支付成功后返回 URL */
  returnUrl?: string;
  /** 用户信息 */
  customer?: {
    /** 用户 ID */
    id?: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
  };
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 支付结果
 */
export interface PaymentResponse {
  /** 是否成功 */
  success: boolean;
  /** 交易 ID（支付平台返回） */
  transactionId?: string;
  /** 支付 URL（跳转支付页面） */
  paymentUrl?: string;
  /** 支付 Token（用于客户端 SDK） */
  paymentToken?: string;
  /** 二维码内容（扫码支付） */
  qrCode?: string;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 支付状态查询结果
 */
export interface PaymentStatusResponse {
  /** 是否查询成功 */
  success: boolean;
  /** 支付状态 */
  status: "pending" | "completed" | "failed" | "cancelled" | "refunded";
  /** 是否已支付 */
  paid: boolean;
  /** 交易 ID */
  transactionId?: string;
  /** 支付时间 */
  paidAt?: Date;
  /** 金额 */
  amount?: number;
  /** 货币 */
  currency?: string;
  /** 错误信息 */
  error?: string;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 退款请求
 */
export interface RefundRequest {
  /** 交易 ID */
  transactionId: string;
  /** 退款金额（单位：分，不填则全额退款） */
  amount?: number;
  /** 退款原因 */
  reason?: string;
}

/**
 * 退款结果
 */
export interface RefundResponse {
  /** 是否成功 */
  success: boolean;
  /** 退款 ID */
  refundId?: string;
  /** 退款状态 */
  status?: "pending" | "completed" | "failed";
  /** 错误信息 */
  error?: string;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 回调通知数据
 */
export interface NotifyData {
  /** 原始请求体 */
  body: unknown;
  /** 请求头 */
  headers: Headers;
  /** 签名（如果有） */
  signature?: string;
}

/**
 * 回调通知处理结果
 */
export interface NotifyResponse {
  /** 是否验证成功 */
  success: boolean;
  /** 订单 ID */
  orderId?: string;
  /** 交易 ID */
  transactionId?: string;
  /** 支付状态 */
  status?: "completed" | "failed" | "cancelled" | "refunded";
  /** 金额 */
  amount?: number;
  /** 货币 */
  currency?: string;
  /** 错误信息 */
  error?: string;
  /** 需要返回给支付平台的响应 */
  platformResponse?: string;
}

/**
 * 支付适配器接口
 *
 * 所有支付方式都需要实现这个接口
 */
export interface PaymentAdapter {
  /** 适配器名称 */
  readonly name: string;

  /** 适配器版本 */
  readonly version: string;

  /**
   * 创建支付
   * @param order - 订单信息
   * @returns 支付结果
   */
  createPayment(order: PaymentOrderInfo): Promise<PaymentResponse>;

  /**
   * 查询支付状态
   * @param transactionId - 交易 ID
   * @returns 支付状态
   */
  queryPayment(transactionId: string): Promise<PaymentStatusResponse>;

  /**
   * 处理回调通知
   * @param data - 通知数据
   * @returns 处理结果
   */
  handleNotify(data: NotifyData): Promise<NotifyResponse>;

  /**
   * 申请退款
   * @param request - 退款请求
   * @returns 退款结果
   */
  refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * 验证配置是否有效
   * @returns 是否有效
   */
  validateConfig(): boolean;

  /**
   * 获取客户端配置（公开信息，可传给前端）
   * @returns 客户端配置
   */
  getClientConfig(): Record<string, unknown>;
}

/**
 * 支付适配器工厂函数类型
 */
export type PaymentAdapterFactory<T> = (config: T) => PaymentAdapter;
