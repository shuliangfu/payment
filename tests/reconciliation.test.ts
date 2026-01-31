/**
 * @fileoverview 对账工具测试
 */

import { describe, it, expect, beforeEach } from "@dreamer/test";
import {
  InMemoryTransactionStore,
  PaymentReconciler,
  createReconciler,
} from "../src/reconciliation.ts";
import type { TransactionRecord } from "../src/types.ts";

describe("对账工具测试", () => {
  describe("内存交易存储", () => {
    let store: InMemoryTransactionStore;

    beforeEach(() => {
      store = new InMemoryTransactionStore();
    });

    it("应该能保存交易记录", async () => {
      const record: TransactionRecord = {
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      };

      await store.save(record);
      expect(store.size).toBe(1);
    });

    it("应该能批量保存交易记录", async () => {
      const records: TransactionRecord[] = [
        {
          transactionId: "tx_001",
          orderId: "order_001",
          amount: 10000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
        {
          transactionId: "tx_002",
          orderId: "order_002",
          amount: 20000,
          currency: "CNY",
          type: "payment",
          status: "pending",
          channel: "stripe",
          createdAt: new Date(),
        },
      ];

      await store.saveBatch(records);
      expect(store.size).toBe(2);
    });

    it("应该能根据交易 ID 获取记录", async () => {
      const record: TransactionRecord = {
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      };

      await store.save(record);
      const retrieved = await store.getByTransactionId("tx_001");

      expect(retrieved).toBeDefined();
      expect(retrieved!.transactionId).toBe("tx_001");
      expect(retrieved!.orderId).toBe("order_001");
    });

    it("应该对不存在的交易 ID 返回 null", async () => {
      const retrieved = await store.getByTransactionId("non_existent");
      expect(retrieved).toBeNull();
    });

    it("应该能根据订单 ID 获取记录", async () => {
      const records: TransactionRecord[] = [
        {
          transactionId: "tx_001",
          orderId: "order_001",
          amount: 10000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
        {
          transactionId: "tx_002",
          orderId: "order_001",
          amount: 5000,
          currency: "CNY",
          type: "refund",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
      ];

      await store.saveBatch(records);
      const retrieved = await store.getByOrderId("order_001");

      expect(retrieved.length).toBe(2);
    });

    it("应该能查询时间范围内的记录", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const records: TransactionRecord[] = [
        {
          transactionId: "tx_001",
          orderId: "order_001",
          amount: 10000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: twoDaysAgo,
        },
        {
          transactionId: "tx_002",
          orderId: "order_002",
          amount: 20000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: yesterday,
        },
        {
          transactionId: "tx_003",
          orderId: "order_003",
          amount: 30000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: now,
        },
      ];

      await store.saveBatch(records);

      // 查询过去 36 小时
      const queryStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
      const retrieved = await store.query(queryStart, now);

      expect(retrieved.length).toBe(2);
    });

    it("应该能按渠道查询记录", async () => {
      const records: TransactionRecord[] = [
        {
          transactionId: "tx_001",
          orderId: "order_001",
          amount: 10000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
        {
          transactionId: "tx_002",
          orderId: "order_002",
          amount: 20000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "alipay",
          createdAt: new Date(),
        },
      ];

      await store.saveBatch(records);

      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date(Date.now() + 60000);

      const stripeRecords = await store.query(startDate, endDate, "stripe");
      expect(stripeRecords.length).toBe(1);
      expect(stripeRecords[0].channel).toBe("stripe");
    });

    it("应该能更新交易状态", async () => {
      const record: TransactionRecord = {
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "pending",
        channel: "stripe",
        createdAt: new Date(),
      };

      await store.save(record);
      await store.updateStatus("tx_001", "completed", new Date());

      const updated = await store.getByTransactionId("tx_001");
      expect(updated!.status).toBe("completed");
      expect(updated!.completedAt).toBeDefined();
    });

    it("应该能统计交易", async () => {
      const records: TransactionRecord[] = [
        {
          transactionId: "tx_001",
          orderId: "order_001",
          amount: 10000,
          currency: "CNY",
          type: "payment",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
        {
          transactionId: "tx_002",
          orderId: "order_002",
          amount: 20000,
          currency: "CNY",
          type: "payment",
          status: "pending",
          channel: "stripe",
          createdAt: new Date(),
        },
        {
          transactionId: "tx_003",
          orderId: "order_001",
          amount: 5000,
          currency: "CNY",
          type: "refund",
          status: "completed",
          channel: "stripe",
          createdAt: new Date(),
        },
      ];

      await store.saveBatch(records);

      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date(Date.now() + 60000);

      const stats = await store.statistics(startDate, endDate);

      expect(stats.totalCount).toBe(2);
      expect(stats.totalAmount).toBe(30000);
      expect(stats.completedCount).toBe(1);
      expect(stats.completedAmount).toBe(10000);
      expect(stats.refundCount).toBe(1);
      expect(stats.refundAmount).toBe(5000);
    });

    it("应该能清空记录", async () => {
      await store.save({
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      });

      expect(store.size).toBe(1);
      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe("对账器", () => {
    let store: InMemoryTransactionStore;
    let reconciler: PaymentReconciler;

    beforeEach(() => {
      store = new InMemoryTransactionStore();
      reconciler = new PaymentReconciler({
        transactionStore: store,
      });
    });

    it("应该能创建对账器", () => {
      expect(reconciler).toBeDefined();
    });

    it("应该能使用便捷函数创建", () => {
      const r = createReconciler({
        transactionStore: store,
      });
      expect(r).toBeDefined();
    });

    it("应该能执行对账（无远程数据）", async () => {
      // 添加本地记录
      await store.save({
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      });

      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date(Date.now() + 60000);

      const result = await reconciler.reconcile(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.localOnlyCount).toBe(1);
      expect(result.matchedCount).toBe(0);
    });

    it("应该能生成对账报告", async () => {
      await store.save({
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      });

      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date(Date.now() + 60000);

      const result = await reconciler.reconcile(startDate, endDate);
      const report = reconciler.generateReport(result);

      expect(report).toContain("支付对账报告");
      expect(report).toContain("统计汇总");
      expect(report).toContain("总交易数: 1");
    });

    it("应该能导出 CSV", async () => {
      await store.save({
        transactionId: "tx_001",
        orderId: "order_001",
        amount: 10000,
        currency: "CNY",
        type: "payment",
        status: "completed",
        channel: "stripe",
        createdAt: new Date(),
      });

      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date(Date.now() + 60000);

      const result = await reconciler.reconcile(startDate, endDate);
      const csv = reconciler.exportToCsv(result);

      expect(csv).toContain("交易ID");
      expect(csv).toContain("tx_001");
      expect(csv).toContain("order_001");
    });
  });
});
