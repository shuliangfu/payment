/**
 * @fileoverview 银联支付适配器示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/unionpay.ts
 * ```
 */

import { createUnionPayAdapter } from "../src/mod.ts";

// 创建银联支付适配器
const unionPay = createUnionPayAdapter({
  merchantId: "777290058110097", // 商户号
  terminalId: "00000001", // 终端号
  signCertPath: "/path/to/sign.pfx", // 签名证书路径
  signCertPassword: "cert_password", // 证书密码
  verifyCertPath: "/path/to/verify.cer", // 验签证书路径
  sandbox: true, // 测试环境
  notifyUrl: "https://your-domain.com/unionpay/notify",
  returnUrl: "https://your-domain.com/unionpay/return",
});

async function main() {
  console.log("=== 银联支付示例 ===\n");

  // 验证配置
  const isValid = await unionPay.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  const config = await unionPay.getClientConfig();
  console.log("客户端配置:", config);

  // 网关支付（PC 端）
  console.log("\n--- 网关支付 ---");
  const gatewayResult = await unionPay.createPayment({
    orderId: "order_union_gateway_001",
    amount: 100, // 1.00 元（分为单位）
    currency: "CNY",
    description: "网关支付测试",
    productName: "测试商品",
  });
  console.log("支付成功:", gatewayResult.success);
  console.log("交易 ID:", gatewayResult.transactionId);
  if (gatewayResult.paymentUrl) {
    console.log("支付链接:", gatewayResult.paymentUrl);
  }

  // 二维码支付
  console.log("\n--- 二维码支付 ---");
  const qrUnionPay = createUnionPayAdapter({
    merchantId: "777290058110097",
    terminalId: "00000001",
    sandbox: true,
  });
  const qrResult = await qrUnionPay.createPayment({
    orderId: "order_union_qr_001",
    amount: 200,
    currency: "CNY",
    description: "扫码支付测试",
  });
  console.log("二维码支付结果:", qrResult.success);

  // 查询订单
  console.log("\n--- 查询订单 ---");
  const status = await unionPay.queryPayment("202401010000000001");
  console.log("订单状态:", status.status);

  // 处理异步通知
  console.log("\n--- 处理通知 ---");
  const mockNotify = {
    headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
    body: {
      merId: "777290058110097",
      orderId: "order_union_001",
      txnAmt: "100",
      respCode: "00",
      respMsg: "成功",
      signature: "mock_signature",
    },
  };
  const notifyResult = await unionPay.handleNotify(mockNotify);
  console.log("通知处理:", notifyResult.success);

  // 退款
  console.log("\n--- 退款 ---");
  const refundResult = await unionPay.refund({
    transactionId: "202401010000000001",
    amount: 100,
    reason: "用户申请退款",
  });
  console.log("退款成功:", refundResult.success);

  console.log("\n示例完成");
}

main().catch(console.error);
