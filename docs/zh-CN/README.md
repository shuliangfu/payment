# @dreamer/payment

> 一个兼容 Deno、Bun 和 Node.js 22+ 的统一支付集成包，支持 8 种支付方式，
> 提供多币种转换和对账工具

📖 **文档**：[English](../../README.md) · **测试报告 (EN)**：[en-US/TEST_REPORT.md](../en-US/TEST_REPORT.md)

[![JSR](https://jsr.io/badges/@dreamer/payment)](https://jsr.io/@dreamer/payment)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![Tests: 84 passed (3 runtimes)](https://img.shields.io/badge/Tests-84%20passed%20%7C%203%20runtimes-brightgreen)](./TEST_REPORT.md)

---

## 📋 变更日志

完整历史：[English](../en-US/CHANGELOG.md) | [中文](./CHANGELOG.md)。

**最新（v1.1.0 - 2026-07-23）**：**新增** – Node.js 22+ 兼容。
**变更** – 将 `web3.test.ts`（Anvil 集成测试）拆为独立的 `test:integration` 任务，
CI 仅运行单元测试；移除 `deno.ns`/`deno.window` 编译 lib；新增 `@dreamer/logger`
（type-only）至 imports；依赖升级。详见 [CHANGELOG](./CHANGELOG.md)。

---

## 🎯 功能

统一支付包提供多种支付方式的集成能力，包括国际支付、国内支付和 Web3 加密货币支付。纯 TypeScript 实现，统一 API 设计，适用于电商平台、订阅服务、数字支付等场景。

核心功能：
- **多支付方式**: 支持 Stripe、PayPal、支付宝、微信、Apple Pay、Google Pay、银联、Web3
- **统一接口**: 所有支付方式使用相同的 API，简化集成
- **多币种转换**: 自动汇率获取和货币转换
- **支付对账**: 本地与平台交易记录对账
- **订阅支付**: 周期性自动扣费（Web3 链上订阅）

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/payment
```

### Bun

```bash
bunx jsr add @dreamer/payment
```

### Node.js 22+

```bash
npx jsr add @dreamer/payment
```

---

## 🌍 环境兼容性

| 环境       | 版本要求  | 状态                                   |
| ---------- | --------- | -------------------------------------- |
| **Deno**   | 2.9+      | ✅ 完全支持                            |
| **Bun**    | 1.3+      | ✅ 完全支持                            |
| **Node.js**| 22+       | ✅ 完全支持                            |
| **服务端** | -         | ✅ 支持（兼容 Deno、Bun 和 Node.js）   |
| **浏览器** | -         | ⚠️ 部分支持（仅客户端 SDK 功能）      |
| **依赖**   | -         | 📦 crypto、i18n、logger、runtime-adapter |

---

## ✨ 特性

### 支付适配器

- **Stripe**: 全球领先的支付处理器
  - Payment Intent 创建
  - Webhook 处理
  - 退款支持
- **PayPal**: 全球最大的在线支付平台
  - OAuth 认证
  - 订单创建和捕获
- **支付宝**: 国内主流支付
  - 扫码支付
  - H5 支付
  - App 支付
- **微信支付**: 国内主流支付
  - Native 支付
  - JSAPI 支付
  - H5 支付
- **Apple Pay**: Apple 设备一键支付
  - 令牌化支付
  - 会话验证
- **Google Pay**: Google 移动支付
  - 令牌化支付
  - 直接集成
- **银联**: 银联支付
  - 网关支付
  - 扫码支付
- **Web3**: 加密货币支付
  - 多链支持（Ethereum、Polygon、BSC、Arbitrum、Optimism、Avalanche、Base）
  - 多代币支持（ETH、USDT、USDC、DAI、WETH、WBTC）
  - 本地测试网（local）和通用测试网（testnet）支持
  - 自定义网络和代币配置
  - 订阅合约集成（PaymentSubscription.sol）
  - **二维码扫码支付**（EIP-681 支付链接）
  - **链上转账监听**（WebSocket 实时 + 轮询两种模式）
  - 交易验证

### 货币转换

- **多汇率提供者**: 支持 Open Exchange Rates、ExchangeRate-API
- **汇率缓存**: 自动缓存减少 API 调用
- **批量转换**: 一次转换多个货币
- **货币格式化**: 正确格式化各国货币

### 支付对账

- **交易存储**: 内存存储或自定义存储
- **自动对账**: 本地与远程记录匹配
- **差异检测**: 金额、状态不匹配检测
- **报告导出**: 文本报告和 CSV 导出

---

## 🎯 使用场景

- **电商平台**: 集成多种支付方式，支持国际和国内用户
- **SaaS 订阅**: 周期性扣款和订阅管理
- **数字内容**: 虚拟商品和数字内容销售
- **跨境电商**: 多币种支付和自动转换
- **Web3 应用**: 加密货币支付和 NFT 交易
- **财务系统**: 交易记录对账和报表生成

---

## 🚀 快速开始

### 创建支付

```typescript
import { createStripeAdapter } from "@dreamer/payment";

// 创建 Stripe 适配器
const stripe = createStripeAdapter({
  publicKey: "pk_test_xxx",
  secretKey: "sk_test_xxx",
  webhookSecret: "whsec_xxx",
});

// 创建支付
const result = await stripe.createPayment({
  orderId: "order_123",
  amount: 10000, // 100.00 USD（单位：分）
  currency: "USD",
  description: "商品购买",
});

if (result.success) {
  console.log("支付创建成功:", result.transactionId);
  console.log("客户端 Token:", result.paymentToken);
}
```

### 使用工厂函数

```typescript
import { createAdapter, getSupportedAdapters } from "@dreamer/payment";

// 查看支持的适配器
console.log(getSupportedAdapters());
// ["stripe", "paypal", "alipay", "wechat", "apple-pay", "google-pay", "unionpay", "web3"]

// 使用工厂函数创建
const alipay = createAdapter("alipay", {
  appId: "your_app_id",
  privateKey: "your_private_key",
  alipayPublicKey: "alipay_public_key",
});
```

### Web3 支付

```typescript
import { createWeb3Adapter } from "@dreamer/payment";

// 基础配置（使用内置默认值）
const web3 = createWeb3Adapter({
  merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
  networks: ["ethereum", "polygon", "bsc"],
  supportedTokens: ["ETH", "USDT", "USDC"],
});

// 高级配置（自定义 RPC、代币、合约）
const web3Advanced = createWeb3Adapter({
  merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
  networks: ["local", "ethereum", "mychain"],
  defaultNetwork: "local",
  supportedTokens: ["ETH", "USDT", "MYTOKEN"],

  // 覆盖默认 RPC（使用自己的节点）
  rpcEndpoints: {
    ethereum: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
  },

  // 添加自定义网络
  customNetworks: {
    mychain: {
      chainId: 12345,
      rpcUrl: "https://rpc.mychain.com",
      explorerUrl: "https://explorer.mychain.com",
      tokens: { USDT: "0x...", MYTOKEN: "0x..." },
    },
  },

  // 订阅合约地址（每个网络单独部署）
  subscriptionContracts: {
    local: "0x721a1ecB9105f2335a8EA7505D343a5a09803A06",
    ethereum: "0x...",
  },
});

// 创建支付（返回支付信息给前端）
const result = await web3.createPayment({
  orderId: "order_456",
  amount: 1000000, // 1 USDT (6 decimals)
  currency: "USDT",
});

// 前端使用 paymentToken 中的信息调用 Web3 钱包
// 或使用 paymentUri 生成二维码让用户扫码支付
const paymentInfo = JSON.parse(result.paymentToken!);
console.log(paymentInfo.paymentUri);
// ethereum:0xToken@1/transfer?address=0xMerchant&uint256=1000000
```

### Web3 二维码支付和链上监听

```typescript
import {
  createWeb3Adapter,
  generatePaymentUri,
  createTransferWatcher,
} from "@dreamer/payment";

// 手动生成 EIP-681 支付链接（用于二维码）
const paymentUri = generatePaymentUri({
  to: "0x商户地址",
  amount: "1000000000000000000", // 1 ETH (Wei)
  chainId: 1,
});
// 使用任意二维码库生成二维码，用户扫码后自动打开钱包

// 创建链上转账监听器（支持 WebSocket 实时监听 + 轮询两种模式）
const watcher = createTransferWatcher({
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
  wssUrl: "wss://mainnet.infura.io/ws/v3/YOUR_KEY", // 提供 WSS 启用实时监听
  address: "0x商户收款地址",
  tokens: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  ],
  confirmations: 3,   // 等待 3 个确认
  mode: "auto",       // auto=自动选择(优先WebSocket), polling=强制轮询, websocket=强制WebSocket
});

// 注册事件回调
watcher.on("transfer", (event) => {
  console.log(`收到 ${event.amount} ${event.token} 从 ${event.from}`);
  console.log(`交易哈希: ${event.txHash}`);
  // 根据金额匹配订单，更新订单状态
});

watcher.on("connected", () => console.log("WebSocket 已连接"));
watcher.on("disconnected", () => console.log("WebSocket 已断开"));
watcher.on("error", (err) => console.error("监听错误:", err));

// 开始监听（自动选择 WebSocket 或轮询模式）
watcher.start();
console.log("当前模式:", watcher.getMode()); // "websocket" 或 "polling"

// 停止监听
// watcher.stop();
```

### Web3 合约部署

Web3 订阅支付功能需要部署智能合约。合约源码位于 `contracts` 目录，请从 GitHub 下载：

```bash
# 克隆仓库获取合约代码
git clone https://github.com/shuliangfu/payment.git
cd payment/contracts
```

**使用 @dreamer/foundry 部署：**

```bash
# 1. 安装 Foundry CLI（全局安装，一次性操作）
deno run -A jsr:@dreamer/foundry/setup

# 2. 进入合约目录
cd contracts

# 3. 配置网络（编辑 config/web3.json）
# 配置 RPC URL、私钥等信息

# 4. 部署合约
foundry deploy --network local      # 本地测试网
foundry deploy --network testnet    # 测试网
foundry deploy --network mainnet    # 主网

# 5. 验证合约（可选）
foundry verify --network testnet -c PaymentSubscription --api-key YOUR_API_KEY
```

> 📚 **详细文档**: https://github.com/shuliangfu/foundry

**配置合约地址：**

```typescript
const web3 = createWeb3Adapter({
  merchantAddress: "0x...",
  networks: ["bsc", "ethereum"],
  subscriptionContracts: {
    bsc: "0x部署的合约地址",
    ethereum: "0x部署的合约地址",
  },
});
```

> ⚠️ **注意**: 订阅支付的周期性扣费需要由项目方在计划任务中调用合约的 `processSubscription` 方法执行。

---

## 🎨 使用示例

### 处理支付回调

```typescript
import { createStripeAdapter } from "@dreamer/payment";

const stripe = createStripeAdapter({
  publicKey: "pk_test_xxx",
  secretKey: "sk_test_xxx",
  webhookSecret: "whsec_xxx",
});

// 处理 Webhook
async function handleWebhook(request: Request) {
  const body = await request.text();

  const result = await stripe.handleNotify({
    body,
    headers: request.headers,
  });

  if (result.success) {
    console.log("订单:", result.orderId);
    console.log("状态:", result.status);
    // 更新订单状态...
  }

  return new Response(result.platformResponse);
}
```

### 货币转换

```typescript
import {
  CurrencyConverter,
  createFixedRatesProvider,
  createOpenExchangeRatesProvider,
  formatCurrency,
} from "@dreamer/payment";

// 使用固定汇率（测试环境）
const fixedProvider = createFixedRatesProvider({
  rates: {
    "USD_CNY": 7.2,
    "USD_EUR": 0.9,
    "EUR_CNY": 8.0,
  },
});

// 使用实时汇率（生产环境）
const liveProvider = createOpenExchangeRatesProvider("your-api-key");

// 创建转换器
const converter = new CurrencyConverter({
  provider: liveProvider,
  fallbackProvider: fixedProvider,
  cacheTTL: 3600000, // 1小时缓存
});

// 转换货币
const result = await converter.convert({
  amount: 10000, // 100 USD
  from: "USD",
  to: "CNY",
});

console.log(result.convertedAmount); // 72000 (720 CNY)
console.log(formatCurrency(result.convertedAmount, "CNY")); // ¥720.00
```

### 支付对账

```typescript
import {
  PaymentReconciler,
  InMemoryTransactionStore,
  StripeTransactionFetcher,
} from "@dreamer/payment";

// 创建交易存储
const store = new InMemoryTransactionStore();

// 记录本地交易
await store.save({
  transactionId: "pi_xxx",
  orderId: "order_123",
  amount: 10000,
  currency: "USD",
  type: "payment",
  status: "completed",
  channel: "stripe",
  createdAt: new Date(),
});

// 创建对账器
const reconciler = new PaymentReconciler({
  transactionStore: store,
  adapters: {
    stripe: stripeAdapter,
  },
  fetchers: {
    stripe: new StripeTransactionFetcher("sk_test_xxx"),
  },
});

// 执行对账
const result = await reconciler.reconcile(
  new Date("2026-01-01"),
  new Date("2026-01-31"),
  "stripe",
);

// 生成报告
console.log(reconciler.generateReport(result));

// 导出 CSV
const csv = reconciler.exportToCsv(result);
```

---

## 📚 API 文档

### 支付适配器接口

所有支付适配器都实现 `PaymentAdapter` 接口：

```typescript
interface PaymentAdapter {
  readonly name: string;
  readonly version: string;

  createPayment(order: PaymentOrderInfo): Promise<PaymentResponse>;
  queryPayment(transactionId: string): Promise<PaymentStatusResponse>;
  handleNotify(data: NotifyData): Promise<NotifyResponse>;
  refund(request: RefundRequest): Promise<RefundResponse>;
  validateConfig(): boolean;
  getClientConfig(): Record<string, unknown>;
}
```

### PaymentOrderInfo

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderId | string | ✅ | 订单 ID |
| amount | number | ✅ | 金额（单位：分） |
| currency | string | | 货币代码（默认根据适配器） |
| description | string | | 订单描述 |
| productName | string | | 商品名称 |
| callbackUrl | string | | 支付回调 URL |
| returnUrl | string | | 支付完成返回 URL |
| customer | object | | 客户信息 |
| metadata | object | | 额外元数据 |

### 适配器配置

| 适配器 | 必填配置 |
|--------|----------|
| Stripe | publicKey, secretKey |
| PayPal | clientId, clientSecret |
| Alipay | appId, privateKey, alipayPublicKey |
| WechatPay | appId, mchId, apiKey |
| ApplePay | merchantId, certificate |
| GooglePay | merchantId, environment |
| UnionPay | merId, signCertPath, signCertPassword |
| Web3 | merchantAddress |

### 货币转换 API

```typescript
// 创建转换器
const converter = new CurrencyConverter({
  provider: ExchangeRateProvider,
  fallbackProvider?: ExchangeRateProvider,
  cacheTTL?: number,
});

// 获取汇率
const rate = await converter.getRate("USD", "CNY");

// 转换货币
const result = await converter.convert({
  amount: 10000,
  from: "USD",
  to: "CNY",
});

// 批量转换
const results = await converter.convertToMultiple(
  10000,
  "USD",
  ["CNY", "EUR", "GBP"],
);
```

### 对账器 API

```typescript
// 创建对账器
const reconciler = new PaymentReconciler({
  transactionStore: TransactionStore,
  adapters?: Record<string, PaymentAdapter>,
  fetchers?: Record<string, RemoteTransactionFetcher>,
  amountTolerance?: number,
});

// 执行对账
const result = await reconciler.reconcile(startDate, endDate, channel?);

// 生成报告
const report = reconciler.generateReport(result);

// 导出 CSV
const csv = reconciler.exportToCsv(result);
```

---

## 🚀 性能优化

### 汇率缓存

```typescript
const converter = new CurrencyConverter({
  provider: liveProvider,
  cacheTTL: 3600000, // 1小时缓存，减少 API 调用
});
```

### 批量操作

```typescript
// 批量保存交易
await store.saveBatch(transactions);

// 批量转换货币
const results = await converter.convertToMultiple(amount, "USD", currencies);
```

---

## 📊 测试报告

| 指标 | 数值 |
|------|------|
| 单元测试数 | 84 |
| 集成测试数 | 5（需 Anvil，独立任务） |
| 通过 | 84（单元） |
| 失败 | 0 |
| 通过率 | 100% |

| 运行时 | 测试数 | 状态 |
|--------|--------|------|
| Deno 2.9+ | 89（84 单元 + 5 生命周期钩子） | ✅ |
| Bun 1.3+ | 84 | ✅ |
| Node.js 22+ | 84 | ✅ |

> `web3.test.ts` 为集成测试（需本地 Anvil 节点 `127.0.0.1:8545`），已拆为独立 `test:integration` 任务，CI 仅运行单元测试。

详细测试报告请查看 [TEST_REPORT.md](TEST_REPORT.md)

---

## 📝 注意事项

1. **密钥安全**: 支付密钥请妥善保管，不要提交到代码仓库
2. **沙箱测试**: 开发阶段请使用各平台的沙箱/测试环境
3. **签名验证**: 回调通知必须验证签名，防止伪造
4. **幂等性**: 支付回调可能重复发送，需要实现幂等处理
5. **Web3 确认**: 区块链交易需要等待足够确认数
6. **汇率时效**: 汇率会实时变动，注意缓存和更新策略

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加新功能'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

[Apache License 2.0](../../LICENSE)

---

Made with ❤️ by Dreamer Team
