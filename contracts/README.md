# Foundry Project

基于 Foundry 的智能合约开发项目。

## 项目结构

```
.
├── src/              # Solidity 合约源码
├── deploy/          # 部署脚本
├── tests/           # 测试文件
├── config/          # 配置文件
│   └── web3.ts      # Web3 网络配置
└── build/           # 构建输出
    └── abi/         # ABI 文件
```

## 快速开始

### 1. 安装依赖

```bash
# 安装 Deno 依赖
deno install

# 编译合约
forge build
```

### 2. 安装全局命令（可选）

如果你想使用全局命令 `foundry` 来部署和验证合约，可以运行：

```bash
deno run -A jsr:@dreamer/foundry/setup
```

安装后，你就可以在任何地方使用 `foundry` 命令了。

### 3. 配置环境变量

```bash
# 编辑 .env 文件，配置你的环境变量
# WEB3_ENV=local  # 可选: local, testnet, mainnet
# ETH_API_KEY=your-api-key  # 用于合约验证
```

注意：项目初始化时已自动创建 `.env` 文件，你可以直接编辑它。

### 4. 配置网络

编辑 `config/web3.ts` 文件，配置你的网络和账户信息。

### 5. 编译合约

```bash
forge build
```

### 6. 运行测试

```bash
# 使用 Deno 测试
deno test -A tests/

# 或使用 Bun 测试
bun test tests/
```

### 7. 部署合约

#### 使用全局命令（推荐）

```bash
# 部署所有合约到指定网络
foundry deploy --network local

# 部署指定合约
foundry deploy --network local --contract MyToken

# 强制重新部署（覆盖已存在的合约）
foundry deploy --network local --force

# 部署并自动验证合约（需要 API Key）
foundry deploy --network local --verify --api-key YOUR_API_KEY

# 如果设置了环境变量 ETH_API_KEY，可以省略 --api-key 参数
foundry deploy --network local --verify

# 部署指定合约并验证
foundry deploy --network local --contract MyToken --verify --api-key YOUR_API_KEY
```

#### 使用 Deno 直接运行

```bash
deno run -A jsr:@dreamer/foundry/cli deploy --network local
```

### 8. 验证合约

#### 使用全局命令（推荐）

```bash
# 验证合约（需要 API Key）
foundry verify --network local --contract MyToken --api-key YOUR_API_KEY

# 如果设置了环境变量 ETH_API_KEY，可以省略 --api-key 参数
foundry verify --network local --contract MyToken
```

#### 使用 Deno 直接运行

```bash
deno run -A jsr:@dreamer/foundry/cli verify --network local --contract MyToken --api-key YOUR_API_KEY
```

## 使用 @dreamer/foundry 库

本项目使用 `@dreamer/foundry` 库进行部署和验证：

```typescript
import { createWeb3 } from "@dreamer/foundry";

// 使用 createWeb3 工厂函数，配置会自动从 config/web3.json 加载并合并参数
const web3 = createWeb3("MyContract");

// 也可以传入 options 来覆盖配置文件中的参数
const web3WithOptions = createWeb3("MyContract", {
  rpcUrl: "http://custom-rpc:8545", // 覆盖配置文件中的 rpcUrl
  // 其他参数使用配置文件中的值
});
```

注意：`createWeb3` 是一个同步工厂函数，会自动加载 `config/web3.json` 中的配置。如果提供了 `options` 参数，会与配置文件中的参数合并，`options` 中的值优先。

## 全局命令说明

安装全局命令后，可以使用以下命令：

- `foundry deploy` - 部署智能合约
  - `--network <网络名>` - 指定网络（可选，默认从 .env 读取 WEB3_ENV）
  - `--contract <合约名>` - 指定要部署的合约（可选）
  - `--force` 或 `-f` - 强制重新部署，即使合约已存在
  - `--verify` - 部署后自动验证合约（需要提供 --api-key 或在 .env 文件中设置 ETH_API_KEY）
  - `--api-key <API_KEY>` - Etherscan/BSCScan API Key（验证时需要，可选，如果设置了 ETH_API_KEY 环境变量）

- `foundry verify` - 验证智能合约
  - `--network <网络名>` - 指定网络（可选，默认从 .env 读取 WEB3_ENV）
  - `--contract <合约名>` - 要验证的合约名称
  - `--api-key <API_KEY>` - Etherscan API Key（可选，如果设置了 ETH_API_KEY 环境变量）

- `foundry init [项目名]` - 初始化新的 Foundry 项目

## 更多信息

- [Foundry 文档](https://book.getfoundry.sh/)
- [@dreamer/foundry 文档](https://jsr.io/@dreamer/foundry)
