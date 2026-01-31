/**
 * @fileoverview PayPal 支付适配器示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/paypal.ts
 * ```
 */

import { createPayPalAdapter } from "../src/mod.ts";
import type { SubscriptionPaymentAdapter } from "../src/types.ts";

// 创建 PayPal 适配器
const paypal = createPayPalAdapter({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
  sandbox: true, // 沙箱环境
  webhookId: "WEBHOOK_ID", // 用于验证 Webhook 签名
}) as SubscriptionPaymentAdapter;

async function main() {
  console.log("=== PayPal 支付示例 ===\n");

  // 验证配置
  const isValid = await paypal.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  const config = await paypal.getClientConfig();
  console.log("客户端配置:", config);

  // 创建支付订单
  console.log("\n--- 创建支付 ---");
  const result = await paypal.createPayment({
    orderId: "order_paypal_001",
    amount: 1999, // 19.99 美元（分为单位）
    currency: "USD",
    description: "商品购买 - PayPal",
    productName: "高级会员",
  });
  console.log("支付成功:", result.success);
  console.log("交易 ID:", result.transactionId);
  if (result.paymentUrl) {
    console.log("支付链接:", result.paymentUrl);
  }

  // 查询支付状态
  console.log("\n--- 查询支付 ---");
  const status = await paypal.queryPayment("PAYPAL_ORDER_ID");
  console.log("支付状态:", status.status);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await paypal.refund({
    transactionId: "CAPTURE_ID",
    amount: 1999,
    reason: "用户申请退款",
  });
  console.log("退款成功:", refundResult.success);

  // 订阅功能
  console.log("\n--- 订阅功能 ---");

  // 检查订阅方法是否存在
  if (paypal.createPlan && paypal.createSubscription) {
    // 创建订阅计划
    const planResult = await paypal.createPlan({
      id: "plan_monthly_vip",
      name: "月度会员",
      description: "每月自动续费的会员服务",
      amount: 999, // 9.99 美元
      currency: "USD",
      interval: "month",
      intervalCount: 1,
    });
    console.log("计划创建成功:", planResult.success);
    console.log("计划 ID:", planResult.planId);

    // 创建订阅
    if (planResult.planId) {
      const subscriptionResult = await paypal.createSubscription({
        planId: planResult.planId,
        customerId: "customer_123",
      });
      console.log("订阅创建成功:", subscriptionResult.success);
      console.log("订阅 ID:", subscriptionResult.subscription?.id);
    }
  } else {
    console.log("订阅方法可用:", !!paypal.createPlan);
  }

  console.log("\n示例完成");
}

main().catch(console.error);
