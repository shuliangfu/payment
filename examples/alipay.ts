/**
 * @fileoverview 支付宝支付适配器示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/alipay.ts
 * ```
 */

import { createAlipayAdapter } from "../src/mod.ts";

// 创建支付宝适配器
const alipay = createAlipayAdapter({
  appId: "2021000000000000",
  privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEvQIBADANBg...（你的私钥）
-----END RSA PRIVATE KEY-----`,
  alipayPublicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqh...（支付宝公钥）
-----END PUBLIC KEY-----`,
  signType: "RSA2",
  sandbox: true, // 沙箱环境
  notifyUrl: "https://your-domain.com/alipay/notify",
});

async function main() {
  console.log("=== 支付宝支付示例 ===\n");

  // 验证配置
  const isValid = await alipay.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  const config = await alipay.getClientConfig();
  console.log("客户端配置:", config);

  // 扫码支付（当面付）
  console.log("\n--- 扫码支付 ---");
  const qrResult = await alipay.createPayment({
    orderId: "order_alipay_qr_001",
    amount: 100, // 1.00 元（分为单位）
    currency: "CNY",
    description: "扫码支付测试",
    productName: "测试商品",
  });
  console.log("支付成功:", qrResult.success);
  console.log("交易 ID:", qrResult.transactionId);

  // 手机网站支付（H5）
  console.log("\n--- H5 支付 ---");
  const h5Result = await alipay.createPayment({
    orderId: "order_alipay_h5_001",
    amount: 200, // 2.00 元
    currency: "CNY",
    description: "H5 支付测试",
    productName: "测试商品",
    returnUrl: "https://your-domain.com/return",
  });
  console.log("支付链接:", h5Result.paymentUrl);

  // 查询订单
  console.log("\n--- 查询订单 ---");
  const status = await alipay.queryPayment("2024010122001400000000000001");
  console.log("订单状态:", status.status);

  // 处理异步通知
  console.log("\n--- 处理通知 ---");
  const mockNotify = {
    headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
    body: {
      trade_status: "TRADE_SUCCESS",
      out_trade_no: "order_alipay_001",
      trade_no: "2024010122001400000000000001",
      total_amount: "1.00",
      sign: "mock_signature",
      sign_type: "RSA2",
    },
  };
  const notifyResult = await alipay.handleNotify(mockNotify);
  console.log("通知处理成功:", notifyResult.success);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await alipay.refund({
    transactionId: "2024010122001400000000000001",
    amount: 100,
    reason: "用户申请退款",
  });
  console.log("退款成功:", refundResult.success);

  console.log("\n示例完成");
}

main().catch(console.error);
