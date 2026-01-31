/**
 * @fileoverview Apple Pay 支付适配器示例
 *
 * Apple Pay 的支付流程主要在客户端（iOS/Web）完成，
 * 服务端主要负责：
 * 1. 提供配置信息给前端
 * 2. 验证商户会话
 * 3. 处理支付令牌
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/apple-pay.ts
 * ```
 */

import { createApplePayAdapter } from "../src/mod.ts";

// 创建 Apple Pay 适配器
const applePay = createApplePayAdapter({
  merchantId: "merchant.com.example.store",
  merchantName: "示例商城",
  paymentProcessor: "stripe", // 后端处理器
  supportedNetworks: ["visa", "masterCard", "amex", "chinaUnionPay"],
  countryCode: "US",
});

async function main() {
  console.log("=== Apple Pay 支付示例 ===\n");

  // 验证配置
  const isValid = await applePay.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置（用于前端初始化 Apple Pay）
  console.log("\n--- 客户端配置 ---");
  const config = await applePay.getClientConfig();
  console.log("商户 ID:", config.merchantId);
  console.log("支持的网络:", config.supportedNetworks);

  // 创建支付请求（返回配置给前端）
  console.log("\n--- 创建支付请求 ---");
  const result = await applePay.createPayment({
    orderId: "order_apple_001",
    amount: 2999, // 29.99 美元
    currency: "USD",
    description: "Apple Pay 购买",
    productName: "高级会员年卡",
  });
  console.log("支付请求创建成功:", result.success);
  console.log("交易 ID:", result.transactionId);

  // 前端使用返回的配置调用 Apple Pay JS API
  // paymentToken 包含需要传递给前端的 PaymentRequest 配置
  if (result.paymentToken) {
    const paymentRequest = JSON.parse(result.paymentToken);
    console.log("\n前端 PaymentRequest 配置:");
    console.log("  国家:", paymentRequest.countryCode);
    console.log("  货币:", paymentRequest.currencyCode);
    console.log("  商户能力:", paymentRequest.merchantCapabilities);
  }

  // 处理支付令牌（前端支付成功后回传）
  console.log("\n--- 处理支付令牌 ---");
  // 实际使用中，这个令牌来自前端 Apple Pay 回调
  const mockPaymentToken = {
    paymentData: {
      data: "base64_encrypted_payment_data",
      signature: "base64_signature",
      header: {
        ephemeralPublicKey: "base64_public_key",
        publicKeyHash: "hash",
        transactionId: "apple_txn_id",
      },
    },
    paymentMethod: {
      displayName: "Visa 1234",
      network: "Visa",
      type: "debit",
    },
    transactionIdentifier: "apple_txn_id",
  };

  // 查询支付状态
  console.log("\n--- 查询支付 ---");
  const status = await applePay.queryPayment(result.transactionId || "");
  console.log("支付状态:", status.status);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await applePay.refund({
    transactionId: result.transactionId || "",
    amount: 2999,
    reason: "用户申请退款",
  });
  console.log("退款结果:", refundResult.success);

  console.log("\n示例完成");
  console.log("\n注意: Apple Pay 需要配合前端 Apple Pay JS API 使用");
  console.log("参考: https://developer.apple.com/documentation/apple_pay_on_the_web");

  // 避免未使用变量警告
  void mockPaymentToken;
}

main().catch(console.error);
