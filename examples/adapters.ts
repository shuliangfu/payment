/**
 * @fileoverview 所有支付适配器基础示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/adapters.ts
 * ```
 */

import {
  createStripeAdapter,
  createPayPalAdapter,
  createAlipayAdapter,
  createWechatPayAdapter,
  createApplePayAdapter,
  createGooglePayAdapter,
  createUnionPayAdapter,
  createWeb3Adapter,
  createAdapter,
  getSupportedAdapters,
} from "../src/mod.ts";

async function main() {
  console.log("=== 支付适配器示例 ===\n");

  // 查看所有支持的适配器
  console.log("支持的适配器:", getSupportedAdapters());

  // 1. Stripe
  console.log("\n--- Stripe ---");
  const stripe = createStripeAdapter({
    publicKey: "pk_test_xxx",
    secretKey: "sk_test_xxx",
  });
  console.log("validateConfig:", await stripe.validateConfig());

  // 2. PayPal
  console.log("\n--- PayPal ---");
  const paypal = createPayPalAdapter({
    clientId: "client_id",
    clientSecret: "client_secret",
    sandbox: true,
  });
  console.log("validateConfig:", await paypal.validateConfig());

  // 3. 支付宝
  console.log("\n--- 支付宝 ---");
  const alipay = createAlipayAdapter({
    appId: "app_id",
    privateKey: "private_key",
    alipayPublicKey: "alipay_public_key",
  });
  console.log("validateConfig:", await alipay.validateConfig());

  // 4. 微信支付
  console.log("\n--- 微信支付 ---");
  const wechat = createWechatPayAdapter({
    appId: "wx_app_id",
    mchId: "mch_id",
    apiKey: "api_key",
  });
  console.log("validateConfig:", await wechat.validateConfig());

  // 5. Apple Pay
  console.log("\n--- Apple Pay ---");
  const applePay = createApplePayAdapter({
    merchantId: "merchant.com.example",
    merchantName: "示例商城",
  });
  console.log("validateConfig:", await applePay.validateConfig());

  // 6. Google Pay
  console.log("\n--- Google Pay ---");
  const googlePay = createGooglePayAdapter({
    merchantId: "merchant_id",
    merchantName: "示例商城",
    gateway: "stripe",
    gatewayMerchantId: "gateway_merchant_id",
  });
  console.log("validateConfig:", await googlePay.validateConfig());

  // 7. 银联
  console.log("\n--- 银联 ---");
  const unionPay = createUnionPayAdapter({
    merchantId: "merchant_id",
    terminalId: "terminal_id",
  });
  console.log("validateConfig:", await unionPay.validateConfig());

  // 8. Web3
  console.log("\n--- Web3 ---");
  const web3 = createWeb3Adapter({
    merchantAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  });
  console.log("validateConfig:", await web3.validateConfig());

  // 使用工厂函数
  console.log("\n--- 工厂函数 ---");
  const stripeViaFactory = createAdapter("stripe", {
    publicKey: "pk_test_xxx",
    secretKey: "sk_test_xxx",
  });
  console.log("工厂创建 Stripe:", await stripeViaFactory.validateConfig());

  console.log("\n示例完成");
}

main().catch(console.error);
