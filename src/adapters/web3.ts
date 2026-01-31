/**
 * @module @dreamer/plugins/payment/adapters/web3
 *
 * Web3 支付适配器
 *
 * 提供加密货币支付集成，支持：
 * - 以太坊 (ETH) 支付
 * - ERC-20 代币支付 (USDT, USDC, DAI 等)
 * - 多链支持 (Ethereum, Polygon, BSC, Arbitrum 等)
 * - MetaMask / WalletConnect 集成
 * - 交易状态查询
 * - 智能合约交互
 *
 * @see https://docs.ethers.org/
 * @see https://docs.walletconnect.com/
 */

import {
  createDefaultLogger,
  type Logger,
  type LoggerOptions,
  type NotifyData,
  type NotifyResponse,
  type PaymentAdapter,
  type PaymentOrderInfo,
  type PaymentResponse,
  type PaymentStatusResponse,
  type RefundRequest,
  type RefundResponse,
} from "../types.ts";

// ========== 预置网络类型 ==========

/**
 * 预置的区块链网络（内置配置）
 */
export type PresetWeb3Network =
  | "local"     // 本地测试网（Anvil/Hardhat/Ganache）
  | "testnet"   // 通用测试网（用户自定义 RPC）
  | "ethereum"  // 以太坊主网
  | "goerli"    // 以太坊测试网
  | "sepolia"   // 以太坊测试网
  | "polygon"   // Polygon 主网
  | "mumbai"    // Polygon 测试网
  | "bsc"       // 币安智能链
  | "arbitrum"  // Arbitrum
  | "optimism"  // Optimism
  | "avalanche" // Avalanche
  | "base";     // Base

/**
 * 网络标识符（预置网络 + 自定义网络）
 */
export type Web3Network = PresetWeb3Network | string;

/**
 * 预置的代币类型（内置配置）
 */
export type PresetWeb3Token =
  | "ETH" // 原生以太币
  | "MATIC" // Polygon 原生代币
  | "BNB" // 币安币
  | "USDT" // Tether
  | "USDC" // USD Coin
  | "DAI" // DAI
  | "WETH" // Wrapped ETH
  | "WBTC"; // Wrapped BTC

/**
 * 代币标识符（预置代币 + 自定义代币）
 */
export type Web3Token = PresetWeb3Token | string;

// ========== 自定义网络配置 ==========

/**
 * 自定义网络配置
 */
export interface CustomNetworkConfig {
  /** Chain ID */
  chainId: number;
  /** RPC 端点 URL */
  rpcUrl: string;
  /** WebSocket 端点 URL（可选，用于事件监听） */
  wssUrl?: string;
  /** 区块浏览器 URL（可选） */
  explorerUrl?: string;
  /** 原生代币符号（如 ETH, MATIC, BNB） */
  nativeToken?: string;
  /** 该网络上的代币地址映射 */
  tokens?: Record<string, string>;
}

/**
 * 自定义代币配置（按网络覆盖/添加代币地址）
 */
export type CustomTokensConfig = Record<string, Record<string, string>>;

// ========== 默认配置（内置值） ==========

/**
 * 默认网络 Chain ID
 */
const DEFAULT_CHAIN_IDS: Record<PresetWeb3Network, number> = {
  local: 31337,
  testnet: 97,       // 默认 BSC 测试网
  ethereum: 1,
  goerli: 5,
  sepolia: 11155111,
  polygon: 137,
  mumbai: 80001,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
};

/**
 * 默认代币合约地址映射
 */
const DEFAULT_TOKEN_ADDRESSES: Record<
  PresetWeb3Network,
  Partial<Record<PresetWeb3Token, string>>
> = {
  local: {},
  testnet: {},  // 测试网需要用户配置
  goerli: {},
  sepolia: {},
  mumbai: {},
  ethereum: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    DAI: "0x6B175474E89094C44Da98b954EescdeCB5BE3830",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  },
  polygon: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
  bsc: {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    DAI: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
  },
  arbitrum: {
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  },
  optimism: {
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  },
  avalanche: {
    USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

/**
 * 默认网络 RPC 端点
 */
const DEFAULT_RPC_ENDPOINTS: Record<PresetWeb3Network, string> = {
  local: "http://127.0.0.1:8545",
  testnet: "https://data-seed-prebsc-1-s1.binance.org:8545",  // 默认 BSC 测试网
  ethereum: "https://eth.llamarpc.com",
  goerli: "https://goerli.infura.io/v3/",
  sepolia: "https://sepolia.infura.io/v3/",
  polygon: "https://polygon-rpc.com",
  mumbai: "https://rpc-mumbai.maticvigil.com",
  bsc: "https://bsc-dataseed.binance.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  base: "https://mainnet.base.org",
};

/**
 * 默认网络区块浏览器
 */
const DEFAULT_EXPLORERS: Record<PresetWeb3Network, string> = {
  local: "http://127.0.0.1:8545",
  testnet: "https://testnet.bscscan.com",  // 默认 BSC 测试网
  ethereum: "https://etherscan.io",
  goerli: "https://goerli.etherscan.io",
  sepolia: "https://sepolia.etherscan.io",
  polygon: "https://polygonscan.com",
  mumbai: "https://mumbai.polygonscan.com",
  bsc: "https://bscscan.com",
  arbitrum: "https://arbiscan.io",
  optimism: "https://optimistic.etherscan.io",
  avalanche: "https://snowtrace.io",
  base: "https://basescan.org",
};

/**
 * 多网络合约地址映射
 * key: 网络名称, value: 合约地址
 */
export type Web3ContractsConfig = Record<string, string>;

/**
 * Web3 支付配置选项
 *
 * @example 基本使用（使用内置默认值）
 * ```typescript
 * const web3 = createWeb3Adapter({
 *   merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
 *   networks: ["ethereum", "polygon"],
 *   supportedTokens: ["ETH", "USDT", "USDC"],
 * });
 * ```
 *
 * @example 高级配置（覆盖默认值 + 自定义网络）
 * ```typescript
 * const web3 = createWeb3Adapter({
 *   merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
 *   networks: ["ethereum", "polygon", "mychain"],
 *
 *   // 覆盖默认 RPC（使用自己的节点，更快更稳定）
 *   rpcEndpoints: {
 *     ethereum: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
 *     polygon: "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY",
 *   },
 *
 *   // 添加自定义网络
 *   customNetworks: {
 *     mychain: {
 *       chainId: 12345,
 *       rpcUrl: "https://rpc.mychain.com",
 *       explorerUrl: "https://explorer.mychain.com",
 *       nativeToken: "MYC",
 *       tokens: {
 *         USDT: "0x...",
 *         MYTOKEN: "0x...",
 *       },
 *     },
 *   },
 *
 *   // 覆盖/添加代币地址
 *   customTokens: {
 *     ethereum: {
 *       MYTOKEN: "0x...",  // 添加新代币
 *     },
 *     polygon: {
 *       USDT: "0x...",     // 覆盖默认地址
 *     },
 *   },
 * });
 * ```
 */
export interface Web3PayConfig {
  /** 商户钱包地址（收款地址） */
  merchantAddress: string;
  /** 支持的网络列表（可包含预置网络和自定义网络） */
  networks?: Web3Network[];
  /** 默认网络 */
  defaultNetwork?: Web3Network;
  /** 支持的代币列表（可包含预置代币和自定义代币） */
  supportedTokens?: Web3Token[];

  // ========== RPC/WSS 端点配置 ==========

  /**
   * 自定义 RPC 端点（覆盖默认值）
   * 建议生产环境使用自己的节点（如 Alchemy、Infura）
   */
  rpcEndpoints?: Record<string, string>;
  /** 自定义 WebSocket 端点（用于事件监听，可选） */
  wssEndpoints?: Record<string, string>;

  // ========== 自定义网络/代币配置 ==========

  /**
   * 自定义网络配置（添加新网络或覆盖预置网络）
   *
   * @example
   * ```typescript
   * customNetworks: {
   *   mychain: {
   *     chainId: 12345,
   *     rpcUrl: "https://rpc.mychain.com",
   *     explorerUrl: "https://explorer.mychain.com",
   *     tokens: { USDT: "0x..." },
   *   },
   * }
   * ```
   */
  customNetworks?: Record<string, CustomNetworkConfig>;

  /**
   * 自定义代币地址（覆盖/添加代币合约地址）
   *
   * @example
   * ```typescript
   * customTokens: {
   *   ethereum: {
   *     MYTOKEN: "0x1234...",  // 添加自定义代币
   *   },
   *   polygon: {
   *     USDT: "0x5678...",     // 覆盖默认 USDT 地址
   *   },
   * }
   * ```
   */
  customTokens?: CustomTokensConfig;

  // ========== API Key 配置（可选） ==========

  /** Infura Project ID（用于以太坊节点访问） */
  infuraId?: string;
  /** Alchemy API Key */
  alchemyApiKey?: string;

  // ========== 交易配置 ==========

  /** 交易确认数（默认 12） */
  confirmations?: number;
  /** 交易超时时间（毫秒，默认 30 分钟） */
  transactionTimeout?: number;
  /** 是否为测试网 */
  testnet?: boolean;
  /** 日志配置 */
  logging?: LoggerOptions;

  // ========== 合约配置（订阅支付） ==========

  /**
   * PaymentSubscription 合约地址配置（可选，用于订阅支付）
   *
   * 每个网络需要单独部署合约，这里配置各网络的合约地址
   *
   * 注意：调用合约方法（如 charge、createPlan）需要项目方在自己的
   * 定时任务或后端服务中使用私钥签名交易，本库只提供 ABI 和工具函数
   *
   * @example
   * ```typescript
   * subscriptionContracts: {
   *   local: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
   *   ethereum: "0x1111111111111111111111111111111111111111",
   *   polygon: "0x2222222222222222222222222222222222222222",
   * }
   * ```
   */
  subscriptionContracts?: Web3ContractsConfig;
}

/**
 * Web3 交易信息
 */
interface Web3Transaction {
  /** 交易哈希 */
  hash: string;
  /** 发送方地址 */
  from: string;
  /** 接收方地址 */
  to: string;
  /** 金额（Wei） */
  value: string;
  /** 代币地址（原生代币为空） */
  tokenAddress?: string;
  /** 网络 */
  network: Web3Network;
  /** 确认数 */
  confirmations: number;
  /** 状态 */
  status: "pending" | "confirmed" | "failed";
  /** 区块号 */
  blockNumber?: number;
  /** Gas 费用 */
  gasUsed?: string;
}

/**
 * 创建 Web3 支付适配器
 *
 * @param config - Web3 配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createWeb3Adapter } from "@dreamer/plugins/payment/adapters/web3";
 *
 * const web3 = createWeb3Adapter({
 *   merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
 *   networks: ["ethereum", "polygon", "bsc"],
 *   supportedTokens: ["ETH", "USDT", "USDC"],
 * });
 *
 * // 创建支付
 * const result = await web3.createPayment({
 *   orderId: "order_123",
 *   amount: 1000000, // 1 USDT (6 decimals)
 *   currency: "USDT",
 * });
 * ```
 */
export function createWeb3Adapter(config: Web3PayConfig): PaymentAdapter {
  const {
    merchantAddress,
    networks = ["ethereum"],
    defaultNetwork = "ethereum",
    supportedTokens = ["ETH", "USDT", "USDC"],
    rpcEndpoints = {},
    wssEndpoints = {},
    customNetworks = {},
    customTokens = {},
    infuraId,
    alchemyApiKey,
    confirmations = 12,
    transactionTimeout = 30 * 60 * 1000, // 30 分钟
    testnet = false,
    logging = {},
    // 合约配置
    subscriptionContracts = {},
  } = config;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "Web3Pay",
    logger: customLogger,
  } = logging;

  // 创建日志器
  const logger: Logger = customLogger || createDefaultLogger({
    enabled: logEnabled,
    level: logLevel,
    prefix: logPrefix,
  });

  // ========== 配置合并逻辑 ==========

  /**
   * 检查是否为预置网络
   */
  const isPresetNetwork = (network: string): network is PresetWeb3Network => {
    return network in DEFAULT_RPC_ENDPOINTS;
  };

  /**
   * 获取网络 Chain ID（合并默认值和自定义配置）
   */
  const getChainId = (network: Web3Network): number => {
    // 优先使用自定义网络配置
    if (customNetworks[network]) {
      return customNetworks[network].chainId;
    }
    // 使用预置默认值
    if (isPresetNetwork(network)) {
      return DEFAULT_CHAIN_IDS[network];
    }
    // 未知网络，抛出错误
    throw new Error(`未知网络 "${network}"，请在 customNetworks 中配置`);
  };

  /**
   * 获取代币合约地址（合并默认值和自定义配置）
   */
  const getTokenAddress = (
    network: Web3Network,
    token: Web3Token,
  ): string | undefined => {
    // 1. 优先使用自定义代币配置
    if (customTokens[network]?.[token]) {
      return customTokens[network][token];
    }
    // 2. 检查自定义网络的代币配置
    if (customNetworks[network]?.tokens?.[token]) {
      return customNetworks[network].tokens![token];
    }
    // 3. 使用预置默认值
    if (isPresetNetwork(network)) {
      return DEFAULT_TOKEN_ADDRESSES[network]?.[token as PresetWeb3Token];
    }
    return undefined;
  };

  /**
   * 获取区块浏览器 URL（合并默认值和自定义配置）
   */
  const getExplorerUrl = (network: Web3Network): string => {
    // 优先使用自定义网络配置
    if (customNetworks[network]?.explorerUrl) {
      return customNetworks[network].explorerUrl!;
    }
    // 使用预置默认值
    if (isPresetNetwork(network)) {
      return DEFAULT_EXPLORERS[network];
    }
    return "";
  };

  /**
   * 日志输出
   */
  const log = (message: string, data?: unknown) => {
    if (logEnabled) {
      logger.debug(`[${logPrefix}] ${message}`, data);
    }
  };

  // 存储待处理交易
  const pendingTransactions = new Map<string, {
    orderId: string;
    expectedAmount: string;
    token: Web3Token;
    network: Web3Network;
    createdAt: number;
  }>();

  /**
   * 获取 RPC 端点（HTTP）
   * 优先级：rpcEndpoints > customNetworks > Infura/Alchemy > 默认值
   */
  const getRpcEndpoint = (network: Web3Network): string => {
    // 1. 优先使用 rpcEndpoints 配置
    if (rpcEndpoints[network]) {
      return rpcEndpoints[network];
    }

    // 2. 检查自定义网络配置
    if (customNetworks[network]?.rpcUrl) {
      return customNetworks[network].rpcUrl;
    }

    // 3. 使用 Infura
    if (
      infuraId &&
      (network === "ethereum" || network === "goerli" || network === "sepolia")
    ) {
      return `https://${network}.infura.io/v3/${infuraId}`;
    }

    // 4. 使用 Alchemy
    if (alchemyApiKey && network === "ethereum") {
      return `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    }

    // 5. 使用预置默认值
    if (isPresetNetwork(network)) {
      return DEFAULT_RPC_ENDPOINTS[network];
    }

    throw new Error(`未知网络 "${network}"，请在 customNetworks 中配置 rpcUrl`);
  };

  /**
   * 获取 WebSocket 端点（用于事件监听）
   * 优先级：wssEndpoints > customNetworks > Infura/Alchemy
   */
  const getWssEndpoint = (network: Web3Network): string | undefined => {
    // 1. 优先使用 wssEndpoints 配置
    if (wssEndpoints[network]) {
      return wssEndpoints[network];
    }

    // 2. 检查自定义网络配置
    if (customNetworks[network]?.wssUrl) {
      return customNetworks[network].wssUrl;
    }

    // 3. 使用 Infura WebSocket
    if (
      infuraId &&
      (network === "ethereum" || network === "goerli" || network === "sepolia")
    ) {
      return `wss://${network}.infura.io/ws/v3/${infuraId}`;
    }

    // 4. 使用 Alchemy WebSocket
    if (alchemyApiKey && network === "ethereum") {
      return `wss://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    }

    // 默认不提供 WebSocket（需要用户配置）
    return undefined;
  };

  /**
   * 获取指定网络的合约地址
   * @param network 网络名称
   * @returns 合约地址，如果未配置则返回 undefined
   */
  const getContractAddress = (network: Web3Network): string | undefined => {
    return subscriptionContracts[network];
  };

  // 检查是否有任何网络配置了合约
  const hasAnySubscriptionContract =
    Object.keys(subscriptionContracts).length > 0;

  /**
   * 格式化金额为 Wei
   */
  const toWei = (amount: number, decimals: number = 18): string => {
    return (BigInt(amount) * BigInt(10 ** decimals)).toString();
  };

  /**
   * 格式化 Wei 为可读金额
   */
  const fromWei = (wei: string, decimals: number = 18): number => {
    return Number(BigInt(wei) / BigInt(10 ** (decimals - 6))) / 1000000;
  };

  /**
   * 获取代币小数位
   */
  const getTokenDecimals = (token: Web3Token): number => {
    switch (token) {
      case "USDT":
      case "USDC":
        return 6;
      case "WBTC":
        return 8;
      default:
        return 18;
    }
  };

  /**
   * 生成支付 ID
   */
  const generatePaymentId = (): string => {
    return `web3_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  /**
   * 调用 RPC 方法
   */
  const rpcCall = async (
    network: Web3Network,
    method: string,
    params: unknown[],
  ): Promise<unknown> => {
    const endpoint = getRpcEndpoint(network);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || "RPC 调用失败");
    }

    return result.result;
  };

  /**
   * 获取交易信息
   */
  const getTransaction = async (
    txHash: string,
    network: Web3Network,
  ): Promise<Web3Transaction | null> => {
    try {
      // 获取交易详情
      const tx =
        (await rpcCall(network, "eth_getTransactionByHash", [txHash])) as {
          from: string;
          to: string;
          value: string;
          blockNumber: string | null;
        } | null;

      if (!tx) {
        return null;
      }

      // 获取交易收据
      const receipt =
        (await rpcCall(network, "eth_getTransactionReceipt", [txHash])) as {
          status: string;
          blockNumber: string;
          gasUsed: string;
        } | null;

      // 获取当前区块号
      const currentBlock =
        (await rpcCall(network, "eth_blockNumber", [])) as string;
      const currentBlockNum = parseInt(currentBlock, 16);
      const txBlockNum = tx.blockNumber ? parseInt(tx.blockNumber, 16) : 0;
      const txConfirmations = tx.blockNumber ? currentBlockNum - txBlockNum : 0;

      return {
        hash: txHash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        network,
        confirmations: txConfirmations,
        status: receipt
          ? (receipt.status === "0x1" ? "confirmed" : "failed")
          : "pending",
        blockNumber: txBlockNum || undefined,
        gasUsed: receipt?.gasUsed,
      };
    } catch (error) {
      log("获取交易失败", error);
      return null;
    }
  };

  return {
    name: "web3",
    version: "1.0.0",

    /**
     * 创建支付
     * 返回前端需要的支付信息，由前端调用 Web3 钱包进行支付
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("创建 Web3 支付", order);

      try {
        const paymentId = generatePaymentId();
        const token = (order.currency as Web3Token) || "ETH";
        const network = defaultNetwork;

        // 验证代币是否支持
        if (!supportedTokens.includes(token)) {
          return {
            success: false,
            error: `不支持的代币: ${token}`,
            errorCode: "UNSUPPORTED_TOKEN",
          };
        }

        // 计算金额
        const decimals = getTokenDecimals(token);
        const amountInWei = toWei(order.amount, decimals - 2); // amount 已经是分，需要调整

        // 获取代币地址
        const tokenAddress =
          token === "ETH" || token === "MATIC" || token === "BNB"
            ? undefined
            : getTokenAddress(network, token);

        // 存储待处理交易
        pendingTransactions.set(paymentId, {
          orderId: order.orderId,
          expectedAmount: amountInWei,
          token,
          network,
          createdAt: Date.now(),
        });

        // 生成 EIP-681 格式的支付链接（用于二维码扫码支付）
        // 格式: ethereum:<address>[@chainId][/function]?[params]
        const chainId = getChainId(network);
        let paymentUri: string;

        if (tokenAddress) {
          // ERC-20 代币转账
          // ethereum:<token_address>@<chainId>/transfer?address=<to>&uint256=<amount>
          paymentUri = `ethereum:${tokenAddress}@${chainId}/transfer?address=${merchantAddress}&uint256=${amountInWei}`;
        } else {
          // 原生代币（ETH/MATIC/BNB）转账
          // ethereum:<to_address>@<chainId>?value=<amount_in_wei>
          paymentUri = `ethereum:${merchantAddress}@${chainId}?value=${amountInWei}`;
        }

        // 构建支付信息
        const paymentInfo = {
          paymentId,
          merchantAddress,
          amount: amountInWei,
          amountFormatted: fromWei(amountInWei, decimals).toFixed(6),
          token,
          tokenAddress,
          network,
          chainId,
          rpcEndpoint: getRpcEndpoint(network),
          explorer: getExplorerUrl(network),
          expiresAt: Date.now() + transactionTimeout,
          // 二维码支付相关
          paymentUri, // EIP-681 支付链接，可直接生成二维码
        };

        log("支付信息已生成", paymentInfo);

        return {
          success: true,
          transactionId: paymentId,
          paymentToken: JSON.stringify(paymentInfo),
          rawResponse: paymentInfo,
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建 Web3 支付失败",
          errorCode: "WEB3_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      log("查询支付状态", transactionId);

      try {
        // 检查是否是交易哈希（以 0x 开头，64位十六进制）
        if (transactionId.startsWith("0x") && transactionId.length === 66) {
          // 直接查询链上交易
          const tx = await getTransaction(transactionId, defaultNetwork);

          if (!tx) {
            return {
              success: false,
              status: "failed",
              paid: false,
              error: "交易不存在",
            };
          }

          const isConfirmed = tx.confirmations >= confirmations;

          return {
            success: true,
            status: tx.status === "confirmed" && isConfirmed
              ? "completed"
              : "pending",
            paid: tx.status === "confirmed" && isConfirmed,
            transactionId: tx.hash,
            rawResponse: {
              ...tx,
              explorerUrl: `${getExplorerUrl(tx.network)}/tx/${tx.hash}`,
            },
          };
        }

        // 查询待处理交易
        const pending = pendingTransactions.get(transactionId);
        if (!pending) {
          return {
            success: false,
            status: "failed",
            paid: false,
            error: "支付记录不存在",
          };
        }

        // 检查是否超时
        if (Date.now() > pending.createdAt + transactionTimeout) {
          pendingTransactions.delete(transactionId);
          return {
            success: true,
            status: "cancelled",
            paid: false,
          };
        }

        return {
          success: true,
          status: "pending",
          paid: false,
          rawResponse: pending,
        };
      } catch (error) {
        log("查询失败", error);
        return {
          success: false,
          status: "failed",
          paid: false,
          error: error instanceof Error ? error.message : "查询失败",
        };
      }
    },

    /**
     * 处理回调通知
     * 前端提交交易哈希后验证交易
     */
    async handleNotify(data: NotifyData): Promise<NotifyResponse> {
      log("处理 Web3 支付通知", data.body);

      try {
        const body = data.body as {
          paymentId?: string;
          txHash?: string;
          network?: Web3Network;
        };

        const { paymentId, txHash, network = defaultNetwork } = body;

        if (!txHash) {
          return {
            success: false,
            error: "缺少交易哈希",
          };
        }

        // 验证交易
        const tx = await getTransaction(txHash, network);

        if (!tx) {
          return {
            success: false,
            error: "交易不存在或尚未上链",
          };
        }

        // 验证接收地址
        if (tx.to.toLowerCase() !== merchantAddress.toLowerCase()) {
          return {
            success: false,
            error: "交易接收地址不匹配",
          };
        }

        // 验证交易状态
        if (tx.status === "failed") {
          return {
            success: true,
            orderId: paymentId,
            transactionId: txHash,
            status: "failed",
            error: "交易执行失败",
            platformResponse: JSON.stringify({ verified: false }),
          };
        }

        // 验证确认数
        const isConfirmed = tx.confirmations >= confirmations;

        // 获取待处理交易信息
        const pending = paymentId
          ? pendingTransactions.get(paymentId)
          : undefined;

        if (isConfirmed && pending && paymentId) {
          // 验证金额
          if (BigInt(tx.value) < BigInt(pending.expectedAmount)) {
            return {
              success: true,
              orderId: pending.orderId,
              transactionId: txHash,
              status: "failed",
              error: "支付金额不足",
              platformResponse: JSON.stringify({ verified: false }),
            };
          }

          // 清除待处理交易
          pendingTransactions.delete(paymentId);
        }

        return {
          success: true,
          orderId: pending?.orderId,
          transactionId: txHash,
          status: isConfirmed ? "completed" : "failed",
          platformResponse: JSON.stringify({
            verified: true,
            confirmations: tx.confirmations,
            requiredConfirmations: confirmations,
          }),
        };
      } catch (error) {
        log("处理通知失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理通知失败",
        };
      }
    },

    /**
     * 申请退款
     * 注意：区块链交易不可逆，退款需要主动发起新交易
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      await Promise.resolve(); // 满足 async 函数要求
      log("申请退款", request);

      // 区块链交易不可逆，无法自动退款
      // 需要商户主动发起转账交易
      return {
        success: false,
        error: "Web3 支付不支持自动退款，请手动发起转账",
        rawResponse: {
          note: "区块链交易不可逆，退款需要商户主动向用户地址发起转账",
          originalTxHash: request.transactionId,
        },
      };
    },

    /**
     * 验证配置
     */
    validateConfig(): boolean {
      if (!merchantAddress) {
        log("配置验证失败：缺少 merchantAddress");
        return false;
      }
      // 验证地址格式
      if (!/^0x[a-fA-F0-9]{40}$/.test(merchantAddress)) {
        log("配置验证失败：merchantAddress 格式无效");
        return false;
      }
      // 验证所有合约地址格式
      for (
        const [network, contractAddress] of Object.entries(
          subscriptionContracts,
        )
      ) {
        if (contractAddress) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
            log(`配置验证失败：${network} 网络的合约地址格式无效`);
            return false;
          }
        }
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      const clientConfig: Record<string, unknown> = {
        merchantAddress,
        networks,
        defaultNetwork,
        supportedTokens,
        confirmations,
        testnet,
        chainIds: networks.reduce((acc, network) => {
          acc[network] = getChainId(network);
          return acc;
        }, {} as Record<string, number>),
        explorers: networks.reduce((acc, network) => {
          acc[network] = getExplorerUrl(network);
          return acc;
        }, {} as Record<string, string>),
        rpcEndpoints: networks.reduce((acc, network) => {
          acc[network] = getRpcEndpoint(network);
          return acc;
        }, {} as Record<string, string>),
      };

      // 添加 WebSocket 端点（如果有）
      const wssConfig: Record<string, string> = {};
      for (const network of networks) {
        const wss = getWssEndpoint(network);
        if (wss) {
          wssConfig[network] = wss;
        }
      }
      if (Object.keys(wssConfig).length > 0) {
        clientConfig.wssEndpoints = wssConfig;
      }

      // 添加合约配置（如果有）
      if (hasAnySubscriptionContract) {
        // 只返回已配置网络的合约地址
        const contractsWithChainId: Record<
          string,
          { address: string; chainId: number }
        > = {};
        for (const network of networks) {
          const contractAddress = getContractAddress(network);
          if (contractAddress) {
            contractsWithChainId[network] = {
              address: contractAddress,
              chainId: getChainId(network),
            };
          }
        }
        clientConfig.subscriptionContracts = contractsWithChainId;
      }

      return clientConfig;
    },
  };
}

// ============================================================================
// 链上转账监听工具
// ============================================================================

/**
 * 转账事件信息
 */
export interface TransferEvent {
  /** 交易哈希 */
  txHash: string;
  /** 发送方地址 */
  from: string;
  /** 接收方地址 */
  to: string;
  /** 转账金额（Wei） */
  amount: string;
  /** 代币地址（原生代币为 undefined） */
  tokenAddress?: string;
  /** 代币符号 */
  token: string;
  /** 区块号 */
  blockNumber: number;
  /** 网络 */
  network: string;
  /** 时间戳（毫秒） */
  timestamp: number;
}

/**
 * 监听配置
 */
export interface WatchTransferConfig {
  /** RPC 端点（用于轮询模式和补充查询） */
  rpcUrl: string;
  /** WebSocket 端点（可选，用于实时监听，优先于轮询） */
  wssUrl?: string;
  /** 监听的地址（商户收款地址） */
  address: string;
  /** 监听的代币（不指定则只监听原生代币） */
  tokens?: Array<{
    symbol: string;
    address: string;
    decimals: number;
  }>;
  /** 网络名称 */
  network?: string;
  /** 轮询间隔（毫秒，默认 5000，仅轮询模式） */
  pollInterval?: number;
  /** 确认数（默认 1） */
  confirmations?: number;
  /** 监听模式（auto=自动选择, websocket=强制WebSocket, polling=强制轮询） */
  mode?: "auto" | "websocket" | "polling";
}

/**
 * 转账监听器
 *
 * 用于监听指定地址的入账转账
 *
 * @example WebSocket 实时监听（推荐）
 * ```typescript
 * const watcher = createTransferWatcher({
 *   rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
 *   wssUrl: "wss://mainnet.infura.io/ws/v3/YOUR_KEY", // 提供 WSS 端点启用实时监听
 *   address: "0x商户地址",
 *   tokens: [{ symbol: "USDT", address: "0x...", decimals: 6 }],
 * });
 *
 * watcher.on("transfer", (event) => {
 *   console.log(`收到 ${event.amount} ${event.token} 从 ${event.from}`);
 *   // 匹配订单并更新状态
 * });
 *
 * watcher.start(); // 自动使用 WebSocket 实时监听
 * ```
 *
 * @example 轮询模式（无 WebSocket 时）
 * ```typescript
 * const watcher = createTransferWatcher({
 *   rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
 *   address: "0x商户地址",
 *   pollInterval: 5000, // 每 5 秒检查一次
 * });
 * ```
 */
export interface TransferWatcher {
  /** 开始监听 */
  start(): void;
  /** 停止监听 */
  stop(): void;
  /** 是否正在运行 */
  isRunning(): boolean;
  /** 获取当前监听模式 */
  getMode(): "websocket" | "polling" | "stopped";
  /** 注册事件回调 */
  on(event: "transfer" | "error" | "connected" | "disconnected", callback: (data: unknown) => void): void;
  /** 移除事件回调 */
  off(event: "transfer" | "error" | "connected" | "disconnected", callback: (data: unknown) => void): void;
  /** 手动检查一次（用于轮询模式或手动触发） */
  check(): Promise<TransferEvent[]>;
}

/**
 * 创建转账监听器
 *
 * 支持两种监听模式：
 * 1. WebSocket 实时监听（推荐）- 通过 eth_subscribe 订阅 Transfer 事件
 * 2. 轮询模式 - 定时查询新区块中的转账
 *
 * 如果提供了 wssUrl，默认使用 WebSocket 模式；否则使用轮询模式
 *
 * @param config - 监听配置
 * @returns 转账监听器
 */
export function createTransferWatcher(config: WatchTransferConfig): TransferWatcher {
  const {
    rpcUrl,
    wssUrl,
    address,
    tokens = [],
    network = "ethereum",
    pollInterval = 5000,
    confirmations = 1,
    mode = "auto",
  } = config;

  // 状态
  let running = false;
  let currentMode: "websocket" | "polling" | "stopped" = "stopped";
  let timer: number | undefined;
  let lastBlockNumber = 0;
  let ws: WebSocket | null = null;
  let wsReconnectTimer: number | undefined;
  let subscriptionIds: string[] = [];

  // 事件回调
  const transferCallbacks: Array<(transfer: TransferEvent) => void> = [];
  const errorCallbacks: Array<(error: unknown) => void> = [];
  const connectedCallbacks: Array<(data: unknown) => void> = [];
  const disconnectedCallbacks: Array<(data: unknown) => void> = [];

  // ERC-20 Transfer 事件签名: Transfer(address,address,uint256)
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  // 代币地址到符号的映射
  const tokenMap = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));

  /**
   * 触发事件回调
   */
  const emit = (event: string, data: unknown): void => {
    if (event === "transfer") {
      for (const cb of transferCallbacks) {
        try {
          cb(data as TransferEvent);
        } catch {
          // 忽略回调错误
        }
      }
    } else if (event === "error") {
      for (const cb of errorCallbacks) {
        try {
          cb(data);
        } catch {
          // 忽略回调错误
        }
      }
    } else if (event === "connected") {
      for (const cb of connectedCallbacks) {
        try {
          cb(data);
        } catch {
          // 忽略回调错误
        }
      }
    } else if (event === "disconnected") {
      for (const cb of disconnectedCallbacks) {
        try {
          cb(data);
        } catch {
          // 忽略回调错误
        }
      }
    }
  };

  /**
   * RPC 请求
   */
  const rpcRequest = async (method: string, params: unknown[]): Promise<unknown> => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || "RPC error");
    }
    return json.result;
  };

  /**
   * 获取当前区块号
   */
  const getBlockNumber = async (): Promise<number> => {
    const result = await rpcRequest("eth_blockNumber", []);
    return parseInt(result as string, 16);
  };

  /**
   * 获取区块时间戳
   */
  const getBlockTimestamp = async (blockNumber: number): Promise<number> => {
    const block = await rpcRequest("eth_getBlockByNumber", [
      "0x" + blockNumber.toString(16),
      false,
    ]) as { timestamp: string } | null;
    return block ? parseInt(block.timestamp, 16) * 1000 : Date.now();
  };

  /**
   * 检查原生代币转账
   */
  const checkNativeTransfers = async (
    fromBlock: number,
    toBlock: number,
  ): Promise<TransferEvent[]> => {
    const events: TransferEvent[] = [];

    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
      const block = await rpcRequest("eth_getBlockByNumber", [
        "0x" + blockNum.toString(16),
        true,
      ]) as { transactions: Array<{ hash: string; from: string; to: string; value: string }> } | null;

      if (!block?.transactions) continue;

      for (const tx of block.transactions) {
        if (tx.to?.toLowerCase() === address.toLowerCase()) {
          const value = BigInt(tx.value);
          if (value > 0n) {
            const timestamp = await getBlockTimestamp(blockNum);
            events.push({
              txHash: tx.hash,
              from: tx.from,
              to: tx.to,
              amount: value.toString(),
              token: "ETH",
              blockNumber: blockNum,
              network,
              timestamp,
            });
          }
        }
      }
    }

    return events;
  };

  /**
   * 检查 ERC-20 代币转账
   */
  const checkTokenTransfers = async (
    fromBlock: number,
    toBlock: number,
  ): Promise<TransferEvent[]> => {
    const events: TransferEvent[] = [];

    if (tokens.length === 0) return events;

    for (const token of tokens) {
      const logs = await rpcRequest("eth_getLogs", [{
        address: token.address,
        topics: [
          TRANSFER_TOPIC,
          null,
          "0x000000000000000000000000" + address.slice(2).toLowerCase(),
        ],
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "0x" + toBlock.toString(16),
      }]) as Array<{
        transactionHash: string;
        topics: string[];
        data: string;
        blockNumber: string;
      }>;

      for (const log of logs) {
        const from = "0x" + log.topics[1].slice(26);
        const amount = BigInt(log.data).toString();
        const blockNumber = parseInt(log.blockNumber, 16);
        const timestamp = await getBlockTimestamp(blockNumber);

        events.push({
          txHash: log.transactionHash,
          from,
          to: address,
          amount,
          tokenAddress: token.address,
          token: token.symbol,
          blockNumber,
          network,
          timestamp,
        });
      }
    }

    return events;
  };

  /**
   * 执行一次检查（轮询模式）
   */
  const doCheck = async (): Promise<TransferEvent[]> => {
    try {
      const currentBlock = await getBlockNumber();
      const confirmedBlock = currentBlock - confirmations;

      if (lastBlockNumber === 0) {
        lastBlockNumber = confirmedBlock;
        return [];
      }

      if (confirmedBlock <= lastBlockNumber) {
        return [];
      }

      const fromBlock = lastBlockNumber + 1;
      const toBlock = confirmedBlock;

      const [nativeEvents, tokenEvents] = await Promise.all([
        checkNativeTransfers(fromBlock, toBlock),
        checkTokenTransfers(fromBlock, toBlock),
      ]);

      lastBlockNumber = toBlock;

      const allEvents = [...nativeEvents, ...tokenEvents];

      for (const event of allEvents) {
        emit("transfer", event);
      }

      return allEvents;
    } catch (error) {
      emit("error", error);
      return [];
    }
  };

  /**
   * 轮询循环
   */
  const poll = async (): Promise<void> => {
    if (!running) return;
    await doCheck();
    if (running) {
      timer = setTimeout(poll, pollInterval) as unknown as number;
    }
  };

  /**
   * 处理 WebSocket 消息
   */
  const handleWsMessage = async (data: {
    method?: string;
    params?: {
      subscription: string;
      result: {
        transactionHash: string;
        topics: string[];
        data: string;
        blockNumber: string;
        address: string;
      };
    };
  }): Promise<void> => {
    if (data.method !== "eth_subscription" || !data.params?.result) return;

    const log = data.params.result;

    // 解析 Transfer 事件
    if (log.topics[0] === TRANSFER_TOPIC) {
      const tokenInfo = tokenMap.get(log.address.toLowerCase());
      if (!tokenInfo) return;

      const from = "0x" + log.topics[1].slice(26);
      const to = "0x" + log.topics[2].slice(26);

      // 检查是否转入目标地址
      if (to.toLowerCase() !== address.toLowerCase()) return;

      const amount = BigInt(log.data).toString();
      const blockNumber = parseInt(log.blockNumber, 16);
      const timestamp = await getBlockTimestamp(blockNumber);

      const event: TransferEvent = {
        txHash: log.transactionHash,
        from,
        to,
        amount,
        tokenAddress: log.address,
        token: tokenInfo.symbol,
        blockNumber,
        network,
        timestamp,
      };

      emit("transfer", event);
    }
  };

  /**
   * 启动 WebSocket 监听
   */
  const startWebSocket = (): void => {
    if (!wssUrl) return;

    try {
      ws = new WebSocket(wssUrl);
      let msgId = 1;

      ws.onopen = () => {
        currentMode = "websocket";
        emit("connected", { mode: "websocket", url: wssUrl });

        // 订阅 ERC-20 Transfer 事件
        if (tokens.length > 0) {
          for (const token of tokens) {
            const subscribeMsg = {
              jsonrpc: "2.0",
              id: msgId++,
              method: "eth_subscribe",
              params: [
                "logs",
                {
                  address: token.address,
                  topics: [
                    TRANSFER_TOPIC,
                    null,
                    "0x000000000000000000000000" + address.slice(2).toLowerCase(),
                  ],
                },
              ],
            };
            ws?.send(JSON.stringify(subscribeMsg));
          }
        }

        // 订阅新区块（用于监听原生代币转账）
        const newHeadsMsg = {
          jsonrpc: "2.0",
          id: msgId++,
          method: "eth_subscribe",
          params: ["newHeads"],
        };
        ws?.send(JSON.stringify(newHeadsMsg));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // 保存订阅 ID
          if (data.result && typeof data.result === "string" && data.result.startsWith("0x")) {
            subscriptionIds.push(data.result);
          }

          // 处理订阅消息
          if (data.method === "eth_subscription") {
            // 检查是否是 newHeads（新区块）
            if (data.params?.result?.transactions === undefined && data.params?.result?.number) {
              // 新区块到来，检查原生代币转账
              const blockNumber = parseInt(data.params.result.number, 16);
              if (blockNumber > lastBlockNumber) {
                const nativeEvents = await checkNativeTransfers(
                  lastBlockNumber > 0 ? lastBlockNumber + 1 : blockNumber,
                  blockNumber,
                );
                lastBlockNumber = blockNumber;
                for (const evt of nativeEvents) {
                  emit("transfer", evt);
                }
              }
            } else {
              // ERC-20 Transfer 事件
              await handleWsMessage(data);
            }
          }
        } catch {
          // 忽略解析错误
        }
      };

      ws.onerror = (error) => {
        emit("error", error);
      };

      ws.onclose = () => {
        emit("disconnected", { mode: "websocket" });
        subscriptionIds = [];

        // 自动重连
        if (running) {
          wsReconnectTimer = setTimeout(() => {
            if (running) startWebSocket();
          }, 5000) as unknown as number;
        }
      };
    } catch (error) {
      emit("error", error);
      // 回退到轮询模式
      if (running && mode !== "websocket") {
        currentMode = "polling";
        poll();
      }
    }
  };

  /**
   * 停止 WebSocket
   */
  const stopWebSocket = (): void => {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = undefined;
    }

    if (ws) {
      // 取消订阅
      for (const subId of subscriptionIds) {
        try {
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "eth_unsubscribe",
            params: [subId],
          }));
        } catch {
          // 忽略
        }
      }
      subscriptionIds = [];

      ws.close();
      ws = null;
    }
  };

  /**
   * 确定使用哪种模式
   */
  const getEffectiveMode = (): "websocket" | "polling" => {
    if (mode === "websocket") return "websocket";
    if (mode === "polling") return "polling";
    // auto: 如果有 wssUrl 则使用 WebSocket
    return wssUrl ? "websocket" : "polling";
  };

  return {
    start(): void {
      if (running) return;
      running = true;

      const effectiveMode = getEffectiveMode();

      if (effectiveMode === "websocket" && wssUrl) {
        startWebSocket();
      } else {
        currentMode = "polling";
        poll();
      }
    },

    stop(): void {
      running = false;
      currentMode = "stopped";

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      stopWebSocket();
    },

    isRunning(): boolean {
      return running;
    },

    getMode(): "websocket" | "polling" | "stopped" {
      return currentMode;
    },

    on(event: "transfer" | "error" | "connected" | "disconnected", callback: (data: unknown) => void): void {
      if (event === "transfer") {
        transferCallbacks.push(callback as (transfer: TransferEvent) => void);
      } else if (event === "error") {
        errorCallbacks.push(callback);
      } else if (event === "connected") {
        connectedCallbacks.push(callback);
      } else if (event === "disconnected") {
        disconnectedCallbacks.push(callback);
      }
    },

    off(event: "transfer" | "error" | "connected" | "disconnected", callback: (data: unknown) => void): void {
      const callbacks = event === "transfer" ? transferCallbacks
        : event === "error" ? errorCallbacks
        : event === "connected" ? connectedCallbacks
        : event === "disconnected" ? disconnectedCallbacks
        : [];
      const index = callbacks.indexOf(callback as never);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    },

    async check(): Promise<TransferEvent[]> {
      return await doCheck();
    },
  };
}

/**
 * 生成 EIP-681 支付链接
 *
 * 用于生成二维码让用户扫码支付
 *
 * @param params - 支付参数
 * @returns EIP-681 格式的支付链接
 *
 * @example 原生代币
 * ```typescript
 * const uri = generatePaymentUri({
 *   to: "0x商户地址",
 *   amount: "1000000000000000000", // 1 ETH (Wei)
 *   chainId: 1,
 * });
 * // ethereum:0x商户地址@1?value=1000000000000000000
 * ```
 *
 * @example ERC-20 代币
 * ```typescript
 * const uri = generatePaymentUri({
 *   to: "0x商户地址",
 *   amount: "1000000", // 1 USDT (6 decimals)
 *   chainId: 1,
 *   tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
 * });
 * // ethereum:0xToken@1/transfer?address=0x商户地址&uint256=1000000
 * ```
 */
export function generatePaymentUri(params: {
  /** 收款地址 */
  to: string;
  /** 金额（最小单位，如 Wei） */
  amount: string;
  /** Chain ID */
  chainId: number;
  /** 代币合约地址（可选，不传则为原生代币） */
  tokenAddress?: string;
}): string {
  const { to, amount, chainId, tokenAddress } = params;

  if (tokenAddress) {
    // ERC-20 代币转账
    return `ethereum:${tokenAddress}@${chainId}/transfer?address=${to}&uint256=${amount}`;
  } else {
    // 原生代币转账
    return `ethereum:${to}@${chainId}?value=${amount}`;
  }
}

// 导出默认工厂函数
export default createWeb3Adapter;
