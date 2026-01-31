/**
 * @fileoverview 微信支付适配器示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/wechat.ts
 * ```
 */

import { createWechatPayAdapter } from "../src/mod.ts";

// 创建微信支付适配器
const wechat = createWechatPayAdapter({
  mchId: "1234567890", // 商户号
  apiKey: "your_api_v3_key", // API v3 密钥
  appId: "wx1234567890abcdef", // 公众号/小程序 AppID
  serialNo: "CERTIFICATE_SERIAL_NO", // 商户证书序列号
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBg...（商户私钥）
-----END PRIVATE KEY-----`,
  tradeType: "NATIVE", // 默认扫码支付
  notifyUrl: "https://your-domain.com/wechat/notify",
});

async function main() {
  console.log("=== 微信支付示例 ===\n");

  // 验证配置
  const isValid = await wechat.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  const config = await wechat.getClientConfig();
  console.log("客户端配置:", config);

  // Native 支付（扫码支付）
  console.log("\n--- Native 扫码支付 ---");
  const nativeResult = await wechat.createPayment({
    orderId: "order_wx_native_001",
    amount: 100, // 1.00 元（分为单位）
    currency: "CNY",
    description: "扫码支付测试",
    productName: "测试商品",
  });
  console.log("支付成功:", nativeResult.success);
  console.log("交易 ID:", nativeResult.transactionId);
  // nativeResult.rawResponse 中包含 code_url（二维码链接）

  // JSAPI 支付（公众号/小程序）
  console.log("\n--- JSAPI 支付 ---");
  const jsapiWechat = createWechatPayAdapter({
    mchId: "1234567890",
    apiKey: "your_api_v3_key",
    appId: "wx1234567890abcdef",
    tradeType: "JSAPI",
    notifyUrl: "https://your-domain.com/wechat/notify",
  });
  const jsapiResult = await jsapiWechat.createPayment({
    orderId: "order_wx_jsapi_001",
    amount: 200,
    currency: "CNY",
    description: "JSAPI 支付测试",
    // 注意：openid 需要通过 metadata 传递
    metadata: { openid: "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o" },
  });
  console.log("JSAPI 结果:", jsapiResult.success);

  // H5 支付
  console.log("\n--- H5 支付 ---");
  const h5Wechat = createWechatPayAdapter({
    mchId: "1234567890",
    apiKey: "your_api_v3_key",
    appId: "wx1234567890abcdef",
    tradeType: "H5", // 使用 H5 而不是 MWEB
    notifyUrl: "https://your-domain.com/wechat/notify",
  });
  const h5Result = await h5Wechat.createPayment({
    orderId: "order_wx_h5_001",
    amount: 300,
    currency: "CNY",
    description: "H5 支付测试",
  });
  console.log("H5 支付链接:", h5Result.paymentUrl);

  // 查询订单
  console.log("\n--- 查询订单 ---");
  const status = await wechat.queryPayment("4200000000202401010000000001");
  console.log("订单状态:", status.status);

  // 处理异步通知
  console.log("\n--- 处理通知 ---");
  const mockNotify = {
    headers: new Headers({
      "Wechatpay-Timestamp": "1609459200",
      "Wechatpay-Nonce": "random_nonce_string",
      "Wechatpay-Signature": "mock_signature",
      "Wechatpay-Serial": "CERTIFICATE_SERIAL_NO",
    }),
    body: {
      resource: {
        ciphertext: "encrypted_data",
        nonce: "nonce_string",
        associated_data: "transaction",
      },
    },
  };
  const notifyResult = await wechat.handleNotify(mockNotify);
  console.log("通知处理:", notifyResult.success);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await wechat.refund({
    transactionId: "4200000000202401010000000001",
    amount: 100,
    reason: "用户申请退款",
  });
  console.log("退款成功:", refundResult.success);

  console.log("\n示例完成");
}

main().catch(console.error);
