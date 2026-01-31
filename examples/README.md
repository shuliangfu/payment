# @dreamer/payment 示例

本目录包含所有支付适配器和工具的使用示例。

## 示例列表

### 支付适配器

| 文件 | 描述 | 运行命令 |
|------|------|----------|
| [adapters.ts](./adapters.ts) | 所有 8 个支付适配器概览 | `deno run -A examples/adapters.ts` |
| [stripe.ts](./stripe.ts) | Stripe 支付（含订阅） | `deno run -A examples/stripe.ts` |
| [paypal.ts](./paypal.ts) | PayPal 支付（含订阅） | `deno run -A examples/paypal.ts` |
| [alipay.ts](./alipay.ts) | 支付宝（扫码/H5） | `deno run -A examples/alipay.ts` |
| [wechat.ts](./wechat.ts) | 微信支付（Native/JSAPI/H5） | `deno run -A examples/wechat.ts` |
| [apple-pay.ts](./apple-pay.ts) | Apple Pay | `deno run -A examples/apple-pay.ts` |
| [google-pay.ts](./google-pay.ts) | Google Pay | `deno run -A examples/google-pay.ts` |
| [unionpay.ts](./unionpay.ts) | 银联支付 | `deno run -A examples/unionpay.ts` |
| [web3.ts](./web3.ts) | Web3 多链支付（ETH/USDT） | `deno run -A examples/web3.ts` |

### 工具

| 文件 | 描述 | 运行命令 |
|------|------|----------|
| [currency.ts](./currency.ts) | 货币转换和格式化 | `deno run -A examples/currency.ts` |
| [reconciliation.ts](./reconciliation.ts) | 支付对账工具 | `deno run -A examples/reconciliation.ts` |

## 快速开始

```bash
# 进入项目目录
cd payment

# 运行所有适配器概览
deno run -A examples/adapters.ts

# 运行 Web3 示例
deno run -A examples/web3.ts

# 运行货币转换示例
deno run -A examples/currency.ts
```

## 注意事项

1. **API 密钥**: 示例中的密钥均为占位符，需要替换为真实的密钥
2. **沙箱环境**: 开发测试请使用各平台的沙箱/测试环境
3. **Web3 本地测试**: Web3 示例可以使用 Anvil 本地测试网
4. **Apple Pay / Google Pay**: 这两个适配器需要配合前端 JS API 使用
