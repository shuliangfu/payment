/**
 * @module @dreamer/payment/types
 *
 * 支付适配器类型定义
 *
 * 提供统一的支付适配器接口，所有支付方式都需要实现这个接口。
 */

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志器接口
 */
export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

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

// ============================================================================
// 订阅支付类型定义
// ============================================================================

/**
 * 订阅计划
 */
export interface SubscriptionPlan {
  /** 计划 ID */
  id: string;
  /** 计划名称 */
  name: string;
  /** 计划描述 */
  description?: string;
  /** 金额（单位：分） */
  amount: number;
  /** 货币代码 */
  currency: string;
  /** 计费周期 */
  interval: "day" | "week" | "month" | "year";
  /** 周期数量（如 interval: "month", intervalCount: 3 表示每 3 个月） */
  intervalCount?: number;
  /** 试用期天数 */
  trialDays?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 创建订阅请求
 */
export interface CreateSubscriptionRequest {
  /** 客户 ID */
  customerId: string;
  /** 计划 ID */
  planId: string;
  /** 支付方式 ID（可选，某些平台需要） */
  paymentMethodId?: string;
  /** 试用期结束后是否自动扣款 */
  autoCharge?: boolean;
  /** 订阅开始日期 */
  startDate?: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 订阅信息
 */
export interface Subscription {
  /** 订阅 ID */
  id: string;
  /** 客户 ID */
  customerId: string;
  /** 计划 ID */
  planId: string;
  /** 订阅状态 */
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "paused";
  /** 当前周期开始时间 */
  currentPeriodStart: Date;
  /** 当前周期结束时间 */
  currentPeriodEnd: Date;
  /** 取消时间 */
  canceledAt?: Date;
  /** 是否在周期结束时取消 */
  cancelAtPeriodEnd?: boolean;
  /** 试用结束时间 */
  trialEnd?: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 订阅操作结果
 */
export interface SubscriptionResponse {
  /** 是否成功 */
  success: boolean;
  /** 订阅信息 */
  subscription?: Subscription;
  /** 错误信息 */
  error?: string;
  /** 原始响应 */
  rawResponse?: unknown;
}

/**
 * 支持订阅的支付适配器接口
 */
export interface SubscriptionPaymentAdapter extends PaymentAdapter {
  /**
   * 创建订阅计划
   * @param plan - 计划信息
   * @returns 创建结果
   */
  createPlan?(plan: SubscriptionPlan): Promise<{ success: boolean; planId?: string; error?: string }>;

  /**
   * 创建订阅
   * @param request - 订阅请求
   * @returns 订阅结果
   */
  createSubscription?(request: CreateSubscriptionRequest): Promise<SubscriptionResponse>;

  /**
   * 取消订阅
   * @param subscriptionId - 订阅 ID
   * @param immediately - 是否立即取消（否则在周期结束时取消）
   * @returns 操作结果
   */
  cancelSubscription?(subscriptionId: string, immediately?: boolean): Promise<SubscriptionResponse>;

  /**
   * 暂停订阅
   * @param subscriptionId - 订阅 ID
   * @returns 操作结果
   */
  pauseSubscription?(subscriptionId: string): Promise<SubscriptionResponse>;

  /**
   * 恢复订阅
   * @param subscriptionId - 订阅 ID
   * @returns 操作结果
   */
  resumeSubscription?(subscriptionId: string): Promise<SubscriptionResponse>;

  /**
   * 查询订阅状态
   * @param subscriptionId - 订阅 ID
   * @returns 订阅信息
   */
  getSubscription?(subscriptionId: string): Promise<SubscriptionResponse>;

  /**
   * 获取客户的所有订阅
   * @param customerId - 客户 ID
   * @returns 订阅列表
   */
  listSubscriptions?(customerId: string): Promise<{ success: boolean; subscriptions?: Subscription[]; error?: string }>;
}

// ============================================================================
// 多币种转换类型定义
// ============================================================================

/**
 * 汇率信息
 */
export interface ExchangeRate {
  /** 源货币 */
  from: string;
  /** 目标货币 */
  to: string;
  /** 汇率 */
  rate: number;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 货币转换请求
 */
export interface CurrencyConversionRequest {
  /** 金额（单位：分） */
  amount: number;
  /** 源货币 */
  from: string;
  /** 目标货币 */
  to: string;
}

/**
 * 货币转换结果
 */
export interface CurrencyConversionResult {
  /** 是否成功 */
  success: boolean;
  /** 原始金额 */
  originalAmount: number;
  /** 转换后金额 */
  convertedAmount: number;
  /** 源货币 */
  from: string;
  /** 目标货币 */
  to: string;
  /** 使用的汇率 */
  rate: number;
  /** 汇率更新时间 */
  rateUpdatedAt: Date;
  /** 错误信息 */
  error?: string;
}

/**
 * 汇率提供者接口
 */
export interface ExchangeRateProvider {
  /** 提供者名称 */
  readonly name: string;

  /**
   * 获取汇率
   * @param from - 源货币
   * @param to - 目标货币
   * @returns 汇率信息
   */
  getRate(from: string, to: string): Promise<ExchangeRate | null>;

  /**
   * 获取多个汇率
   * @param baseCurrency - 基准货币
   * @param targetCurrencies - 目标货币列表
   * @returns 汇率映射
   */
  getRates(baseCurrency: string, targetCurrencies: string[]): Promise<Map<string, ExchangeRate>>;
}

// ============================================================================
// 支付对账类型定义
// ============================================================================

/**
 * 交易记录
 */
export interface TransactionRecord {
  /** 交易 ID */
  transactionId: string;
  /** 订单 ID */
  orderId: string;
  /** 金额（单位：分） */
  amount: number;
  /** 货币 */
  currency: string;
  /** 交易类型 */
  type: "payment" | "refund";
  /** 交易状态 */
  status: "pending" | "completed" | "failed" | "cancelled";
  /** 支付渠道 */
  channel: string;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 手续费 */
  fee?: number;
  /** 净额 */
  netAmount?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 对账记录
 */
export interface ReconciliationRecord {
  /** 本地记录 */
  local: TransactionRecord;
  /** 平台记录 */
  remote?: TransactionRecord;
  /** 匹配状态 */
  status: "matched" | "local_only" | "remote_only" | "amount_mismatch" | "status_mismatch";
  /** 差异描述 */
  differences?: string[];
}

/**
 * 对账结果
 */
export interface ReconciliationResult {
  /** 是否成功 */
  success: boolean;
  /** 开始时间 */
  startDate: Date;
  /** 结束时间 */
  endDate: Date;
  /** 总交易数 */
  totalCount: number;
  /** 匹配数 */
  matchedCount: number;
  /** 差异数 */
  mismatchCount: number;
  /** 仅本地数 */
  localOnlyCount: number;
  /** 仅远程数 */
  remoteOnlyCount: number;
  /** 对账记录 */
  records: ReconciliationRecord[];
  /** 本地总金额 */
  localTotalAmount: number;
  /** 远程总金额 */
  remoteTotalAmount: number;
  /** 金额差异 */
  amountDifference: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 对账器接口
 */
export interface Reconciler {
  /**
   * 执行对账
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   * @returns 对账结果
   */
  reconcile(startDate: Date, endDate: Date, channel?: string): Promise<ReconciliationResult>;

  /**
   * 获取本地交易记录
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   * @returns 交易记录列表
   */
  getLocalTransactions(startDate: Date, endDate: Date, channel?: string): Promise<TransactionRecord[]>;

  /**
   * 获取平台交易记录
   * @param adapter - 支付适配器
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 交易记录列表
   */
  getRemoteTransactions(adapter: PaymentAdapter, startDate: Date, endDate: Date): Promise<TransactionRecord[]>;
}

/**
 * 创建默认日志器
 *
 * @param options - 日志配置
 * @returns 日志器实例
 */
export function createDefaultLogger(options: LoggerOptions = {}): Logger {
  const { enabled = false, prefix = "Payment" } = options;

  const log = (level: string, message: string, data?: unknown) => {
    if (!enabled) return;
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${prefix}] ${message}`;
    if (data !== undefined) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  };

  return {
    debug: (message: string, data?: unknown) => log("debug", message, data),
    info: (message: string, data?: unknown) => log("info", message, data),
    warn: (message: string, data?: unknown) => log("warn", message, data),
    error: (message: string, data?: unknown) => log("error", message, data),
  };
}
