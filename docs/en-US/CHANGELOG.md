# Changelog

All notable changes to @dreamer/payment are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.0] - 2026-07-23

### Added

- **Node.js 22+ compatibility**: Cross-runtime support for Deno, Bun, and Node.js 22+.

### Changed

- **Integration test split**: Split `web3.test.ts` (requires a local Anvil node at `127.0.0.1:8545`) into a standalone `test:integration` task; CI and `test`/`test:node` now run unit tests only (`crypto`, `currency`, `mod`, `reconciliation`, `subscription`).
- **Compiler libs**: Removed `deno.ns`/`deno.window` (and `dom.asynciterable`) from `deno.json` compiler options to avoid conflicts with `nodeModulesDir: auto`.
- **`@dreamer/logger` dependency**: Added `@dreamer/logger` (type-only, used in `src/adapters/types.ts`) to `deno.json` imports and `package.json` dependencies for correctness.
- **Dependency bumps**: `@dreamer/i18n` ^1.1.2, `@dreamer/runtime-adapter` ^1.2.2, `@dreamer/crypto` ^1.1.0, `@dreamer/test` ^1.2.3.
- **Infrastructure**: Added `package.json` (engines.node>=22, `test:node` via tsx), `tsconfig.json`, `.npmrc` (`@jsr:registry`), Node 22 jobs to `ci.yml` (9-job matrix), `package-lock.json` to `.gitignore`.

### Tests

- Deno 2.9+: 89 (84 unit + 5 lifecycle hooks)
- Bun 1.3+: 84
- Node.js 22+: 84

---

## [1.0.0] - 2026-02-19

### Added

- **Official release**: First official version with stable API.
- **Payment adapters** (`src/adapters/`): Stripe, PayPal, Web3 (crypto); unified adapter interface; create payment, query, refund.
- **International and domestic**: Support for multiple payment methods and currencies.
- **Internationalization (i18n)**: Server-side messages (unknown adapter/network, API request failed, etc.) in en-US and zh-CN via `@dreamer/i18n`; locale from `LANGUAGE` / `LC_ALL` / `LANG`; `$tr`, `setPaymentLocale`, `detectLocale` exported from `./i18n.ts`.

### Compatibility

- Deno 2.6+
- Bun 1.3.5+
