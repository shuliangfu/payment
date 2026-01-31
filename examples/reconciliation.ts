/**
 * @fileoverview 支付对账工具示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/reconciliation.ts
 * ```
 */

import {
  InMemoryTransactionStore,
  PaymentReconciler,
  type TransactionRecord,
} from "../src/mod.ts";

async function main() {
  console.log("=== 支付对账工具示例 ===\n");

  // 创建内存交易存储
  const store = new InMemoryTransactionStore();

  // 添加测试交易记录
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const twoHoursAgo = new Date(now.getTime() - 7200000);
  const halfHourAgo = new Date(now.getTime() - 1800000);

  const records: TransactionRecord[] = [
    {
      transactionId: "txn_001",
      orderId: "order_001",
      amount: 1000,
      currency: "USD",
      type: "payment",
      status: "completed",
      channel: "stripe",
      createdAt: oneHourAgo,
    },
    {
      transactionId: "txn_002",
      orderId: "order_002",
      amount: 2000,
      currency: "USD",
      type: "payment",
      status: "completed",
      channel: "stripe",
      createdAt: twoHoursAgo,
    },
    {
      transactionId: "txn_003",
      orderId: "order_003",
      amount: 500,
      currency: "USD",
      type: "payment",
      status: "pending",
      channel: "paypal",
      createdAt: halfHourAgo,
    },
  ];

  // 批量保存
  await store.saveBatch(records);
  console.log("已保存", records.length, "条交易记录");

  // 查询交易
  console.log("\n--- 查询交易 ---");
  const record = await store.getByTransactionId("txn_001");
  console.log("查询 txn_001:", record?.orderId);

  const byOrder = await store.getByOrderId("order_002");
  console.log("查询 order_002:", byOrder.length > 0 ? byOrder[0].transactionId : "未找到");

  // 按时间范围查询
  const yesterday = new Date(now.getTime() - 86400000);
  const stripeRecords = await store.query(yesterday, now, "stripe");
  console.log("Stripe 交易数:", stripeRecords.length);

  // 创建对账器
  console.log("\n--- 执行对账 ---");
  const remoteRecords: TransactionRecord[] = [
    { ...records[0] }, // 匹配
    { ...records[1], amount: 2100 }, // 金额不匹配
  ];

  const reconciler = new PaymentReconciler({
    transactionStore: store,
    fetchers: {
      stripe: {
        fetch: () => Promise.resolve(remoteRecords),
      },
    },
  });

  const result = await reconciler.reconcile(yesterday, now, "stripe");

  console.log("对账成功:", result.success);
  console.log("总交易数:", result.totalCount);
  console.log("匹配数:", result.matchedCount);
  console.log("差异数:", result.mismatchCount);

  if (result.records.length > 0) {
    console.log("\n对账记录:");
    for (const r of result.records) {
      console.log(`  ${r.local.transactionId}: ${r.status}`);
    }
  }

  console.log("\n示例完成");
}

main().catch(console.error);
