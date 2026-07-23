# 变更日志

@dreamer/payment 的所有重要变更均记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-07-23

### 新增

- **正式版发布**：首个正式版本，API 稳定。
- **支付适配器**（`src/adapters/`）：Stripe、PayPal、支付宝、微信、Apple Pay、Google Pay、银联、Web3（加密货币）；统一适配器接口；创建支付、查询、退款。
- **国际与国内**：多支付方式、多币种支持。
- **国际化（i18n）**：服务端文案（未知适配器/网络、API 请求失败等）提供 en-US 与 zh-CN，基于 `@dreamer/i18n`；语言由 `LANGUAGE` / `LC_ALL` / `LANG` 决定；从 `./i18n.ts` 导出 `$tr`、`setPaymentLocale`、`detectLocale`。
- **Node.js 22+ 兼容**：支持 Deno、Bun 和 Node.js 22+ 三运行时。

### 变更

- **集成测试拆分**：将 `web3.test.ts`（需本地 Anvil 节点 `127.0.0.1:8545`）拆为独立的 `test:integration` 任务；CI 与 `test`/`test:node` 仅运行单元测试（`crypto`、`currency`、`mod`、`reconciliation`、`subscription`）。
- **编译 lib**：从 `deno.json` 编译选项中移除 `deno.ns`/`deno.window`（及 `dom.asynciterable`），避免与 `nodeModulesDir: auto` 冲突。
- **`@dreamer/logger` 依赖**：将 `@dreamer/logger`（type-only，用于 `src/adapters/types.ts`）加入 `deno.json` imports 与 `package.json` dependencies。
- **适配器 i18n**：将 `src/adapters` 中的硬编码中文文案替换为 `$tr()` 调用，经 `@dreamer/runtime-adapter` 实现 Node 兼容的本地化。
- **依赖升级**：`@dreamer/i18n` ^1.1.2、`@dreamer/runtime-adapter` ^1.2.2、`@dreamer/crypto` ^1.1.0、`@dreamer/test` ^1.2.3。
- **基础设施**：新增 `package.json`（engines.node>=22，`test:node` 经 tsx）、`tsconfig.json`、`.npmrc`（`@jsr:registry`）、`ci.yml` Node 22 任务（9 任务矩阵）、`.gitignore` 加入 `package-lock.json`。
- **文档**：重构为 `docs/en-US` 与 `docs/zh-CN`；标准化 `LICENSE`。

### 兼容性

- Deno 2.9+
- Bun 1.3+
- Node.js 22+

### 测试

- Deno 2.9+：89（84 单元 + 5 生命周期钩子）
- Bun 1.3+：84
- Node.js 22+：84
