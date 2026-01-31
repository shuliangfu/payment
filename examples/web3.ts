/**
 * @fileoverview Web3 支付适配器示例
 *
 * 演示功能：
 * - 创建支付（前端集成模式）
 * - 二维码扫码支付（EIP-681 支付链接）
 * - 链上转账监听
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/web3.ts
 * ```
 */

import {
  createWeb3Adapter,
  PaymentSubscriptionABI,
  generatePlanId,
  generateOrderId,
  createTransferWatcher,
  generatePaymentUri,
  type TransferEvent,
} from "../src/mod.ts";

// 基础配置
const web3 = createWeb3Adapter({
  merchantAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  networks: ["local", "ethereum"],
  defaultNetwork: "local",
  supportedTokens: ["ETH", "USDT"],
  customTokens: {
    local: {
      USDT: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    },
  },
  subscriptionContracts: {
    local: "0x721a1ecB9105f2335a8EA7505D343a5a09803A06",
  },
});

async function main() {
  console.log("=== Web3 支付示例 ===\n");

  // 验证配置
  const isValid = await web3.validateConfig();
  console.log("配置是否有效:", isValid);

  // 获取客户端配置
  console.log("\n--- 客户端配置 ---");
  const config = await web3.getClientConfig();
  console.log(JSON.stringify(config, null, 2));

  // 创建 ETH 支付
  console.log("\n--- 创建 ETH 支付 ---");
  const ethResult = await web3.createPayment({
    orderId: "order_eth_001",
    amount: 100000000000000000, // 0.1 ETH
    currency: "ETH",
    description: "ETH 支付测试",
  });
  console.log("支付结果:", ethResult.success);
  if (ethResult.paymentToken) {
    const info = JSON.parse(ethResult.paymentToken);
    console.log("支付信息:", JSON.stringify(info, null, 2));
  }

  // 创建 USDT 支付
  console.log("\n--- 创建 USDT 支付 ---");
  const usdtResult = await web3.createPayment({
    orderId: "order_usdt_001",
    amount: 10000000, // 10 USDT
    currency: "USDT",
    description: "USDT 支付测试",
  });
  console.log("支付结果:", usdtResult.success);
  if (usdtResult.paymentToken) {
    const info = JSON.parse(usdtResult.paymentToken);
    console.log("代币地址:", info.tokenAddress);
  }

  // 合约 ABI 信息
  console.log("\n--- 订阅合约 ABI ---");
  console.log("ABI 方法数量:", PaymentSubscriptionABI.length);

  // 生成 ID 工具
  console.log("\n--- ID 生成工具 ---");
  console.log("计划 ID:", generatePlanId("monthly_vip", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"));
  console.log("订单 ID:", generateOrderId("order_123"));

  // ==========================================
  // 二维码扫码支付
  // ==========================================
  console.log("\n=== 二维码扫码支付 ===\n");

  // 方式1: createPayment 返回的 paymentUri 直接用于生成二维码
  console.log("--- 从 createPayment 获取支付链接 ---");
  if (ethResult.rawResponse) {
    const info = ethResult.rawResponse as { paymentUri?: string };
    console.log("ETH 支付链接:", info.paymentUri);
    console.log("  → 使用任意二维码库生成二维码，用户扫码后自动打开钱包");
  }

  // 方式2: 手动生成 EIP-681 支付链接
  console.log("\n--- 手动生成支付链接 ---");
  const ethPaymentUri = generatePaymentUri({
    to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    amount: "1000000000000000000", // 1 ETH
    chainId: 1, // Ethereum Mainnet
  });
  console.log("ETH 支付链接:", ethPaymentUri);

  const usdtPaymentUri = generatePaymentUri({
    to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    amount: "10000000", // 10 USDT (6 decimals)
    chainId: 1,
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Mainnet
  });
  console.log("USDT 支付链接:", usdtPaymentUri);

  // ==========================================
  // 链上转账监听
  // ==========================================
  console.log("\n=== 链上转账监听 ===\n");

  // 创建转账监听器（支持 WebSocket 实时 + 轮询两种模式）
  const watcher = createTransferWatcher({
    rpcUrl: "http://127.0.0.1:8545", // 本地 Anvil 节点
    wssUrl: "ws://127.0.0.1:8545",   // WebSocket 端点（实时监听）
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    network: "local",
    confirmations: 1,
    tokens: [
      {
        symbol: "USDT",
        address: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
        decimals: 6,
      },
    ],
    mode: "auto", // auto=自动选择(优先WebSocket), polling=强制轮询, websocket=强制WebSocket
  });

  // 注册事件回调
  watcher.on("transfer", (event) => {
    const evt = event as TransferEvent;
    console.log("\n🎉 收到转账!");
    console.log(`  从: ${evt.from}`);
    console.log(`  金额: ${evt.amount} ${evt.token}`);
    console.log(`  交易: ${evt.txHash}`);
    console.log(`  区块: ${evt.blockNumber}`);
    // 在这里匹配订单并更新状态
  });

  watcher.on("connected", () => console.log("✅ WebSocket 已连接"));
  watcher.on("disconnected", () => console.log("❌ WebSocket 已断开"));
  watcher.on("error", (err) => console.error("监听错误:", err));

  console.log("监听器已创建（未启动）");
  console.log("  watcher.start() - 开始监听");
  console.log("  watcher.stop() - 停止监听");
  console.log("  watcher.getMode() - 获取当前模式 (websocket/polling)");
  console.log("  watcher.check() - 手动检查一次");

  // 示例：手动检查一次（不启动持续监听）
  // const events = await watcher.check();
  // console.log("检查到的转账:", events.length);

  console.log("\n示例完成");
}

main().catch(console.error);
