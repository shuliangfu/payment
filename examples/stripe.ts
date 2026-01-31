/**
 * @fileoverview Stripe 支付适配器示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/stripe.ts
 * ```
 */

import { createStripeAdapter } from "../src/mod.ts";
import type { SubscriptionPaymentAdapter } from "../src/types.ts";

// 创建 Stripe 适配器
const stripe = createStripeAdapter({
  publicKey: "pk_test_xxx",
  secretKey: "sk_test_xxx",
  webhookSecret: "whsec_xxx",
}) as SubscriptionPaymentAdapter;

async function main() {
  console.log("=== Stripe 支付示例 ===\n");

  // 验证配置
  const isValid = await stripe.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  const config = await stripe.getClientConfig();
  console.log("客户端配置:", config);

  // 创建支付
  console.log("\n--- 创建支付 ---");
  const result = await stripe.createPayment({
    orderId: "order_123",
    amount: 1000,
    currency: "USD",
    description: "商品购买",
  });
  console.log("支付结果:", result);

  // 查询支付
  console.log("\n--- 查询支付 ---");
  const status = await stripe.queryPayment("pi_test_xxx");
  console.log("支付状态:", status);

  // 订阅功能
  console.log("\n--- 订阅功能 ---");
  console.log("createPlan 存在:", typeof stripe.createPlan === "function");
  console.log("createSubscription 存在:", typeof stripe.createSubscription === "function");

  console.log("\n示例完成");
}

main().catch(console.error);
