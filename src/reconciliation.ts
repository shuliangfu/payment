/**
 * @module @dreamer/payment/reconciliation
 *
 * 支付对账工具
 *
 * 提供本地交易记录与支付平台交易记录的对账功能
 *
 * @example
 * ```typescript
 * import { PaymentReconciler, InMemoryTransactionStore } from "@dreamer/payment";
 *
 * // 创建交易存储
 * const store = new InMemoryTransactionStore();
 *
 * // 创建对账器
 * const reconciler = new PaymentReconciler({
 *   transactionStore: store,
 *   adapters: {
 *     stripe: stripeAdapter,
 *     alipay: alipayAdapter,
 *   },
 * });
 *
 * // 执行对账
 * const result = await reconciler.reconcile(
 *   new Date("2026-01-01"),
 *   new Date("2026-01-31"),
 *   "stripe"
 * );
 * ```
 */

import type {
  PaymentAdapter,
  ReconciliationRecord,
  ReconciliationResult,
  TransactionRecord,
} from "./types.ts";

// ============================================================================
// 交易存储接口
// ============================================================================

/**
 * 交易存储接口
 *
 * 用于存储和查询本地交易记录
 */
export interface TransactionStore {
  /**
   * 保存交易记录
   * @param record - 交易记录
   */
  save(record: TransactionRecord): Promise<void>;

  /**
   * 批量保存交易记录
   * @param records - 交易记录列表
   */
  saveBatch(records: TransactionRecord[]): Promise<void>;

  /**
   * 根据交易 ID 获取记录
   * @param transactionId - 交易 ID
   */
  getByTransactionId(transactionId: string): Promise<TransactionRecord | null>;

  /**
   * 根据订单 ID 获取记录
   * @param orderId - 订单 ID
   */
  getByOrderId(orderId: string): Promise<TransactionRecord[]>;

  /**
   * 查询时间范围内的交易记录
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   */
  query(startDate: Date, endDate: Date, channel?: string): Promise<TransactionRecord[]>;

  /**
   * 更新交易状态
   * @param transactionId - 交易 ID
   * @param status - 新状态
   * @param completedAt - 完成时间
   */
  updateStatus(
    transactionId: string,
    status: TransactionRecord["status"],
    completedAt?: Date,
  ): Promise<void>;

  /**
   * 统计交易
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   */
  statistics(
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<{
    totalCount: number;
    totalAmount: number;
    completedCount: number;
    completedAmount: number;
    refundCount: number;
    refundAmount: number;
  }>;
}

// ============================================================================
// 内存交易存储实现
// ============================================================================

/**
 * 内存交易存储
 *
 * 用于开发和测试环境
 */
export class InMemoryTransactionStore implements TransactionStore {
  /** 交易记录存储 */
  private records: Map<string, TransactionRecord> = new Map();

  /**
   * 保存交易记录
   * @param record - 交易记录
   */
  async save(record: TransactionRecord): Promise<void> {
    await Promise.resolve();
    this.records.set(record.transactionId, { ...record });
  }

  /**
   * 批量保存交易记录
   * @param records - 交易记录列表
   */
  async saveBatch(records: TransactionRecord[]): Promise<void> {
    await Promise.resolve();
    for (const record of records) {
      this.records.set(record.transactionId, { ...record });
    }
  }

  /**
   * 根据交易 ID 获取记录
   * @param transactionId - 交易 ID
   */
  async getByTransactionId(transactionId: string): Promise<TransactionRecord | null> {
    await Promise.resolve();
    return this.records.get(transactionId) || null;
  }

  /**
   * 根据订单 ID 获取记录
   * @param orderId - 订单 ID
   */
  async getByOrderId(orderId: string): Promise<TransactionRecord[]> {
    await Promise.resolve();
    const results: TransactionRecord[] = [];
    for (const record of this.records.values()) {
      if (record.orderId === orderId) {
        results.push({ ...record });
      }
    }
    return results;
  }

  /**
   * 查询时间范围内的交易记录
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   */
  async query(
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<TransactionRecord[]> {
    await Promise.resolve();
    const results: TransactionRecord[] = [];

    for (const record of this.records.values()) {
      const recordTime = record.createdAt.getTime();
      if (recordTime >= startDate.getTime() && recordTime <= endDate.getTime()) {
        if (!channel || record.channel === channel) {
          results.push({ ...record });
        }
      }
    }

    // 按创建时间排序
    results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return results;
  }

  /**
   * 更新交易状态
   * @param transactionId - 交易 ID
   * @param status - 新状态
   * @param completedAt - 完成时间
   */
  async updateStatus(
    transactionId: string,
    status: TransactionRecord["status"],
    completedAt?: Date,
  ): Promise<void> {
    await Promise.resolve();
    const record = this.records.get(transactionId);
    if (record) {
      record.status = status;
      if (completedAt) {
        record.completedAt = completedAt;
      }
    }
  }

  /**
   * 统计交易
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选）
   */
  async statistics(
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<{
    totalCount: number;
    totalAmount: number;
    completedCount: number;
    completedAmount: number;
    refundCount: number;
    refundAmount: number;
  }> {
    const records = await this.query(startDate, endDate, channel);

    let totalCount = 0;
    let totalAmount = 0;
    let completedCount = 0;
    let completedAmount = 0;
    let refundCount = 0;
    let refundAmount = 0;

    for (const record of records) {
      if (record.type === "payment") {
        totalCount++;
        totalAmount += record.amount;
        if (record.status === "completed") {
          completedCount++;
          completedAmount += record.amount;
        }
      } else if (record.type === "refund") {
        refundCount++;
        refundAmount += record.amount;
      }
    }

    return {
      totalCount,
      totalAmount,
      completedCount,
      completedAmount,
      refundCount,
      refundAmount,
    };
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * 获取记录数量
   */
  get size(): number {
    return this.records.size;
  }
}

// ============================================================================
// 远程交易获取器
// ============================================================================

/**
 * 远程交易获取器接口
 *
 * 用于从支付平台获取交易记录
 */
export interface RemoteTransactionFetcher {
  /**
   * 获取远程交易记录
   * @param adapter - 支付适配器
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 交易记录列表
   */
  fetch(
    adapter: PaymentAdapter,
    startDate: Date,
    endDate: Date,
  ): Promise<TransactionRecord[]>;
}

/**
 * Stripe 交易获取器
 */
export class StripeTransactionFetcher implements RemoteTransactionFetcher {
  /** Stripe API 密钥 */
  private secretKey: string;

  /**
   * 创建 Stripe 交易获取器
   * @param secretKey - Stripe API 密钥
   */
  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  /**
   * 获取远程交易记录
   * @param _adapter - 支付适配器（未使用，使用内部密钥）
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 交易记录列表
   */
  async fetch(
    _adapter: PaymentAdapter,
    startDate: Date,
    endDate: Date,
  ): Promise<TransactionRecord[]> {
    const records: TransactionRecord[] = [];

    try {
      // 获取 Payment Intents
      const url = new URL("https://api.stripe.com/v1/payment_intents");
      url.searchParams.set("created[gte]", Math.floor(startDate.getTime() / 1000).toString());
      url.searchParams.set("created[lte]", Math.floor(endDate.getTime() / 1000).toString());
      url.searchParams.set("limit", "100");

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${this.secretKey}`,
        },
      });

      if (!response.ok) {
        return records;
      }

      const data = await response.json() as {
        data: Array<{
          id: string;
          amount: number;
          currency: string;
          status: string;
          created: number;
          metadata?: { orderId?: string };
          charges?: {
            data: Array<{
              balance_transaction?: string;
            }>;
          };
        }>;
      };

      for (const pi of data.data) {
        // 转换状态
        let status: TransactionRecord["status"] = "pending";
        if (pi.status === "succeeded") {
          status = "completed";
        } else if (pi.status === "canceled") {
          status = "cancelled";
        } else if (pi.status === "requires_payment_method") {
          status = "failed";
        }

        records.push({
          transactionId: pi.id,
          orderId: pi.metadata?.orderId || pi.id,
          amount: pi.amount,
          currency: pi.currency.toUpperCase(),
          type: "payment",
          status,
          channel: "stripe",
          createdAt: new Date(pi.created * 1000),
          completedAt: status === "completed" ? new Date(pi.created * 1000) : undefined,
        });
      }
    } catch {
      // 忽略错误
    }

    return records;
  }
}

// ============================================================================
// 对账器实现
// ============================================================================

/**
 * 对账器配置
 */
export interface ReconcilerConfig {
  /** 交易存储 */
  transactionStore: TransactionStore;
  /** 支付适配器映射 */
  adapters?: Record<string, PaymentAdapter>;
  /** 远程交易获取器映射 */
  fetchers?: Record<string, RemoteTransactionFetcher>;
  /** 金额容差（分，默认 0） */
  amountTolerance?: number;
}

/**
 * 支付对账器
 *
 * 用于对账本地交易记录与支付平台交易记录
 */
export class PaymentReconciler {
  /** 交易存储 */
  private store: TransactionStore;
  /** 支付适配器 */
  private adapters: Record<string, PaymentAdapter>;
  /** 远程交易获取器 */
  private fetchers: Record<string, RemoteTransactionFetcher>;
  /** 金额容差 */
  private amountTolerance: number;

  /**
   * 创建对账器
   * @param config - 配置
   */
  constructor(config: ReconcilerConfig) {
    this.store = config.transactionStore;
    this.adapters = config.adapters || {};
    this.fetchers = config.fetchers || {};
    this.amountTolerance = config.amountTolerance || 0;
  }

  /**
   * 添加支付适配器
   * @param channel - 渠道名称
   * @param adapter - 支付适配器
   */
  addAdapter(channel: string, adapter: PaymentAdapter): void {
    this.adapters[channel] = adapter;
  }

  /**
   * 添加远程交易获取器
   * @param channel - 渠道名称
   * @param fetcher - 获取器
   */
  addFetcher(channel: string, fetcher: RemoteTransactionFetcher): void {
    this.fetchers[channel] = fetcher;
  }

  /**
   * 执行对账
   *
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param channel - 支付渠道（可选，不指定则对账所有渠道）
   * @returns 对账结果
   */
  async reconcile(
    startDate: Date,
    endDate: Date,
    channel?: string,
  ): Promise<ReconciliationResult> {
    // 获取本地交易记录
    const localRecords = await this.store.query(startDate, endDate, channel);

    // 获取远程交易记录
    const remoteRecords: TransactionRecord[] = [];
    const channels = channel ? [channel] : Object.keys(this.adapters);

    for (const ch of channels) {
      const fetcher = this.fetchers[ch];
      const adapter = this.adapters[ch];

      if (fetcher && adapter) {
        const records = await fetcher.fetch(adapter, startDate, endDate);
        remoteRecords.push(...records);
      }
    }

    // 构建映射
    const localMap = new Map<string, TransactionRecord>();
    for (const record of localRecords) {
      localMap.set(record.transactionId, record);
    }

    const remoteMap = new Map<string, TransactionRecord>();
    for (const record of remoteRecords) {
      remoteMap.set(record.transactionId, record);
    }

    // 对账
    const records: ReconciliationRecord[] = [];
    let matchedCount = 0;
    let mismatchCount = 0;
    let localOnlyCount = 0;
    let remoteOnlyCount = 0;
    let localTotalAmount = 0;
    let remoteTotalAmount = 0;

    // 遍历本地记录
    for (const local of localRecords) {
      localTotalAmount += local.amount;
      const remote = remoteMap.get(local.transactionId);

      if (!remote) {
        // 仅本地存在
        records.push({
          local,
          status: "local_only",
          differences: ["远程不存在此交易"],
        });
        localOnlyCount++;
      } else {
        // 比较记录
        const differences: string[] = [];

        // 检查金额
        const amountDiff = Math.abs(local.amount - remote.amount);
        if (amountDiff > this.amountTolerance) {
          differences.push(`金额不匹配：本地 ${local.amount}，远程 ${remote.amount}`);
        }

        // 检查状态
        if (local.status !== remote.status) {
          differences.push(`状态不匹配：本地 ${local.status}，远程 ${remote.status}`);
        }

        if (differences.length === 0) {
          records.push({ local, remote, status: "matched" });
          matchedCount++;
        } else {
          const hasAmountMismatch = differences.some((d) => d.includes("金额"));
          records.push({
            local,
            remote,
            status: hasAmountMismatch ? "amount_mismatch" : "status_mismatch",
            differences,
          });
          mismatchCount++;
        }

        // 从远程映射中移除
        remoteMap.delete(local.transactionId);
      }
    }

    // 遍历剩余的远程记录（仅远程存在）
    for (const remote of remoteMap.values()) {
      remoteTotalAmount += remote.amount;
      records.push({
        local: {
          transactionId: remote.transactionId,
          orderId: remote.orderId,
          amount: 0,
          currency: remote.currency,
          type: remote.type,
          status: "pending",
          channel: remote.channel,
          createdAt: remote.createdAt,
        },
        remote,
        status: "remote_only",
        differences: ["本地不存在此交易"],
      });
      remoteOnlyCount++;
    }

    // 计算远程总金额
    for (const remote of remoteRecords) {
      remoteTotalAmount += remote.amount;
    }
    // 修正：避免重复计算
    remoteTotalAmount = remoteRecords.reduce((sum, r) => sum + r.amount, 0);

    return {
      success: true,
      startDate,
      endDate,
      totalCount: records.length,
      matchedCount,
      mismatchCount,
      localOnlyCount,
      remoteOnlyCount,
      records,
      localTotalAmount,
      remoteTotalAmount,
      amountDifference: localTotalAmount - remoteTotalAmount,
    };
  }

  /**
   * 生成对账报告
   *
   * @param result - 对账结果
   * @returns 报告字符串
   */
  generateReport(result: ReconciliationResult): string {
    const lines: string[] = [];

    lines.push("═".repeat(60));
    lines.push("支付对账报告");
    lines.push("═".repeat(60));
    lines.push("");
    lines.push(`对账时间范围: ${result.startDate.toISOString()} - ${result.endDate.toISOString()}`);
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");

    lines.push("─".repeat(60));
    lines.push("统计汇总");
    lines.push("─".repeat(60));
    lines.push(`总交易数: ${result.totalCount}`);
    lines.push(`匹配数: ${result.matchedCount} (${((result.matchedCount / result.totalCount) * 100).toFixed(2)}%)`);
    lines.push(`差异数: ${result.mismatchCount}`);
    lines.push(`仅本地: ${result.localOnlyCount}`);
    lines.push(`仅远程: ${result.remoteOnlyCount}`);
    lines.push("");
    lines.push(`本地总金额: ${(result.localTotalAmount / 100).toFixed(2)}`);
    lines.push(`远程总金额: ${(result.remoteTotalAmount / 100).toFixed(2)}`);
    lines.push(`金额差异: ${(result.amountDifference / 100).toFixed(2)}`);
    lines.push("");

    // 差异详情
    const mismatches = result.records.filter((r) => r.status !== "matched");
    if (mismatches.length > 0) {
      lines.push("─".repeat(60));
      lines.push("差异详情");
      lines.push("─".repeat(60));

      for (const record of mismatches) {
        lines.push(`交易ID: ${record.local.transactionId}`);
        lines.push(`状态: ${record.status}`);
        if (record.differences) {
          for (const diff of record.differences) {
            lines.push(`  - ${diff}`);
          }
        }
        lines.push("");
      }
    }

    lines.push("═".repeat(60));
    lines.push(`对账${result.success ? "完成" : "失败"}`);
    lines.push("═".repeat(60));

    return lines.join("\n");
  }

  /**
   * 导出对账结果为 CSV
   *
   * @param result - 对账结果
   * @returns CSV 字符串
   */
  exportToCsv(result: ReconciliationResult): string {
    const lines: string[] = [];

    // CSV 头
    lines.push([
      "交易ID",
      "订单ID",
      "本地金额",
      "远程金额",
      "货币",
      "本地状态",
      "远程状态",
      "对账状态",
      "创建时间",
      "差异",
    ].join(","));

    // 数据行
    for (const record of result.records) {
      const row = [
        record.local.transactionId,
        record.local.orderId,
        record.local.amount.toString(),
        record.remote?.amount?.toString() || "",
        record.local.currency,
        record.local.status,
        record.remote?.status || "",
        record.status,
        record.local.createdAt.toISOString(),
        `"${(record.differences || []).join("; ")}"`,
      ];
      lines.push(row.join(","));
    }

    return lines.join("\n");
  }
}

/**
 * 创建对账器的便捷函数
 *
 * @param config - 配置
 * @returns 对账器实例
 */
export function createReconciler(config: ReconcilerConfig): PaymentReconciler {
  return new PaymentReconciler(config);
}
