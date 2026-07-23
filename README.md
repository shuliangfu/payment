# @dreamer/payment

> 📖 English (this README) | [中文文档](./docs/zh-CN/README.md)

> A unified payment integration for Deno, Bun, and Node.js 22+: 8 payment
> methods, multi-currency, reconciliation, and Web3 crypto payments.

[![JSR](https://jsr.io/badges/@dreamer/payment)](https://jsr.io/@dreamer/payment)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests: 84 passed (3 runtimes)](https://img.shields.io/badge/Tests-84%20passed%20%7C%203%20runtimes-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## 📋 Changelog

See [en-US](./docs/en-US/CHANGELOG.md) | [zh-CN](./docs/zh-CN/CHANGELOG.md) for
full history.

**Latest (v1.0.0 - 2026-07-23)**: **Added** – Node.js 22+ compatibility.
**Changed** – Split `web3.test.ts` (Anvil integration) into a separate
`test:integration` task; CI runs unit tests only. Removed `deno.ns`/`deno.window`
compiler libs; added `@dreamer/logger` (type-only) to imports; dependency bumps.
See [CHANGELOG](./docs/en-US/CHANGELOG.md).

---

## 📦 Installation

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

## 🌍 Runtime Compatibility

| Runtime     | Version | Status                                             |
| ----------- | ------- | -------------------------------------------------- |
| **Deno**    | 2.9+    | ✅ Full support                                    |
| **Bun**     | 1.3+    | ✅ Full support                                    |
| **Node.js** | 22+     | ✅ Full support                                    |
| **Browser** | -       | ⚠️ Partial (client SDK features only)              |
| **Dependencies** | -  | 📦 @dreamer/crypto · @dreamer/i18n · @dreamer/logger (type-only) · @dreamer/runtime-adapter |

---

## Features

International, domestic, and Web3 crypto payments; unified API; multi-currency
conversion; reconciliation; TypeScript. 8 adapters: Stripe, PayPal, Alipay,
WeChat, Apple Pay, Google Pay, UnionPay, Web3.

---

## 📊 Test Report

| Metric        | Deno | Bun  | Node.js |
| ------------- | ---- | ---- | ------- |
| **Total**     | 89   | 84   | 84      |
| **Passed**    | 89   | 84   | 84      |
| **Failed**    | 0    | 0    | 0       |
| **Pass rate** | 100% | 100% | 100%    |

> Unit tests only (5 files). `web3.test.ts` (27 tests) is an Anvil integration
> test, split to `test:integration` and excluded from CI. Deno counts 5
> lifecycle hooks on top of the 84 unit tests. See
> [docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md).

---

## Documentation

- **Full (中文)**: [docs/zh-CN/README.md](./docs/zh-CN/README.md)
- **Test (EN)**: [docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md) · **Test (中文)**: [docs/zh-CN/TEST_REPORT.md](./docs/zh-CN/TEST_REPORT.md)

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE)

---

<div align="center">**Made with ❤️ by Dreamer Team**</div>
