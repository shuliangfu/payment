/**
 * @fileoverview Google Pay 支付适配器示例
 *
 * Google Pay 的支付流程主要在客户端完成，
 * 服务端主要负责：
 * 1. 提供 PaymentDataRequest 配置给前端
 * 2. 处理支付令牌
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/google-pay.ts
 * ```
 */

import { createGooglePayAdapter } from "../src/mod.ts";

// 创建 Google Pay 适配器
const googlePay = createGooglePayAdapter({
  merchantId: "BCR2DN4XXXXXX", // Google Pay 商户 ID
  merchantName: "示例商城",
  gateway: "stripe", // 支付网关
  gatewayMerchantId: "acct_xxxxx", // 网关商户 ID
  allowedCardNetworks: ["AMEX", "DISCOVER", "MASTERCARD", "VISA"],
  allowedCardAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
});

async function main() {
  console.log("=== Google Pay 支付示例 ===\n");

  // 验证配置
  const isValid = await googlePay.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  console.log("\n--- 客户端配置 ---");
  const config = await googlePay.getClientConfig();
  console.log("商户 ID:", config.merchantId);
  console.log("网关:", config.gateway);

  // 创建支付请求（返回 PaymentDataRequest 给前端）
  console.log("\n--- 创建支付请求 ---");
  const result = await googlePay.createPayment({
    orderId: "order_google_001",
    amount: 1999, // 19.99 美元
    currency: "USD",
    description: "Google Pay 购买",
    productName: "专业版订阅",
  });
  console.log("支付请求创建成功:", result.success);
  console.log("交易 ID:", result.transactionId);

  // 前端使用返回的配置调用 Google Pay API
  if (result.paymentToken) {
    const paymentDataRequest = JSON.parse(result.paymentToken);
    console.log("\n前端 PaymentDataRequest 配置:");
    console.log("  API Version:", paymentDataRequest.apiVersion);
    console.log("  交易信息:", paymentDataRequest.transactionInfo);
  }

  // 模拟前端返回的支付令牌
  const mockPaymentToken = {
    apiVersion: 2,
    apiVersionMinor: 0,
    paymentMethodData: {
      type: "CARD",
      description: "Visa •••• 1234",
      tokenizationData: {
        type: "PAYMENT_GATEWAY",
        token: "encrypted_payment_token",
      },
    },
  };

  // 查询支付状态
  console.log("\n--- 查询支付 ---");
  const status = await googlePay.queryPayment(result.transactionId || "");
  console.log("支付状态:", status.status);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await googlePay.refund({
    transactionId: result.transactionId || "",
    amount: 1999,
    reason: "用户申请退款",
  });
  console.log("退款结果:", refundResult.success);

  console.log("\n示例完成");
  console.log("\n注意: Google Pay 需要配合前端 Google Pay API 使用");
  console.log("参考: https://developers.google.com/pay/api/web/guides/tutorial");

  // 避免未使用变量警告
  void mockPaymentToken;
}

main().catch(console.error);
