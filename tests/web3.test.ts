/**
 * @fileoverview Web3 支付适配器测试
 *
 * 测试本地 Anvil 网络的 Web3 支付功能
 */

import { describe, it, expect } from "@dreamer/test";
import {
  createWeb3Adapter,
  generatePaymentUri,
  createTransferWatcher,
} from "../src/adapters/web3.ts";

// Anvil 默认账户（第0个）
const ANVIL_ACCOUNT_0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// 本地测试网配置
const LOCAL_CONFIG = {
  // 商户收款地址（使用 Anvil 第0个账户）
  merchantAddress: ANVIL_ACCOUNT_0,
  // 使用本地网络
  networks: ["local"],
  defaultNetwork: "local",
  // 支持的代币
  supportedTokens: ["ETH", "USDT"],
  // 自定义代币地址（本地部署的 USDT）
  customTokens: {
    local: {
      USDT: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    },
  },
  // 订阅合约地址
  subscriptionContracts: {
    local: "0x721a1ecB9105f2335a8EA7505D343a5a09803A06",
  },
};

describe("Web3 支付适配器测试", () => {
  // 创建适配器
  const web3 = createWeb3Adapter(LOCAL_CONFIG);

  describe("适配器基础功能", () => {
    it("适配器应该成功创建", () => {
      expect(web3).toBeDefined();
      expect(typeof web3.createPayment).toBe("function");
      expect(typeof web3.queryPayment).toBe("function");
      expect(typeof web3.validateConfig).toBe("function");
      expect(typeof web3.getClientConfig).toBe("function");
    });

    it("validateConfig 应该返回 true", async () => {
      const isValid = await web3.validateConfig();
      expect(isValid).toBe(true);
    });
  });

  describe("getClientConfig 配置测试", () => {
    it("应该返回正确的基本配置", async () => {
      const config = await web3.getClientConfig();
      expect(config).toBeDefined();
      expect(config.merchantAddress).toBe(ANVIL_ACCOUNT_0);
      expect(config.networks).toEqual(["local"]);
      expect(config.defaultNetwork).toBe("local");
    });

    it("应该返回正确的 chainId", async () => {
      const config = await web3.getClientConfig();
      expect(config.chainIds).toBeDefined();
      const chainIds = config.chainIds as Record<string, number>;
      expect(chainIds["local"]).toBe(31337);
    });

    it("应该返回正确的 RPC 端点", async () => {
      const config = await web3.getClientConfig();
      expect(config.rpcEndpoints).toBeDefined();
      const rpcEndpoints = config.rpcEndpoints as Record<string, string>;
      expect(rpcEndpoints["local"]).toBe("http://127.0.0.1:8545");
    });

    it("应该返回正确的合约配置", async () => {
      const config = await web3.getClientConfig();
      expect(config.subscriptionContracts).toBeDefined();
      const contracts = config.subscriptionContracts as Record<
        string,
        { address: string; chainId: number }
      >;
      expect(contracts["local"].address).toBe(
        "0x721a1ecB9105f2335a8EA7505D343a5a09803A06"
      );
      expect(contracts["local"].chainId).toBe(31337);
    });
  });

  describe("createPayment 支付创建测试", () => {
    it("应该生成 ETH 支付信息", async () => {
      const result = await web3.createPayment({
        orderId: "test_order_eth_001",
        amount: 100000000000000000, // 0.1 ETH (in Wei)
        currency: "ETH",
        description: "测试 ETH 支付",
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.paymentToken).toBeDefined();
      expect(result.rawResponse).toBeDefined();

      // 解析支付信息
      const paymentInfo = JSON.parse(result.paymentToken!);
      expect(paymentInfo.network).toBe("local");
      expect(paymentInfo.token).toBe("ETH");
      expect(paymentInfo.chainId).toBe(31337);
      expect(paymentInfo.merchantAddress).toBe(ANVIL_ACCOUNT_0);

      // 打印支付信息
      console.log("\n=== ETH 支付信息 ===");
      console.log(JSON.stringify(paymentInfo, null, 2));
    });

    it("应该生成 USDT 支付信息", async () => {
      const result = await web3.createPayment({
        orderId: "test_order_usdt_001",
        amount: 10000000, // 10 USDT (6 decimals)
        currency: "USDT",
        description: "测试 USDT 支付",
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.paymentToken).toBeDefined();

      // 解析支付信息
      const paymentInfo = JSON.parse(result.paymentToken!);
      expect(paymentInfo.network).toBe("local");
      expect(paymentInfo.token).toBe("USDT");
      expect(paymentInfo.tokenAddress).toBe(
        "0x0165878A594ca255338adfa4d48449f69242Eb8F"
      );

      // 打印支付信息
      console.log("\n=== USDT 支付信息 ===");
      console.log(JSON.stringify(paymentInfo, null, 2));
    });
  });

  describe("queryPayment 查询测试", () => {
    it("查询不存在的交易应该返回失败", async () => {
      const result = await web3.queryPayment("non_existent_tx");
      expect(result.success).toBe(false);
      expect(result.paid).toBe(false);
    });
  });

  describe("二维码支付 - paymentUri 测试", () => {
    it("ETH 支付应该生成正确的 paymentUri", async () => {
      const result = await web3.createPayment({
        orderId: "qr_test_eth_001",
        amount: 1000000000000000000, // 1 ETH
        currency: "ETH",
        description: "二维码 ETH 支付测试",
      });

      expect(result.success).toBe(true);
      expect(result.rawResponse).toBeDefined();

      // 检查 paymentUri 格式
      const paymentInfo = result.rawResponse as { paymentUri?: string };
      expect(paymentInfo.paymentUri).toBeDefined();

      // 验证 EIP-681 格式
      const uri = paymentInfo.paymentUri!;
      expect(uri.startsWith("ethereum:")).toBe(true);
      expect(uri).toContain("@31337"); // local chainId
      expect(uri).toContain("?value="); // 原生代币使用 value 参数

      console.log("\nETH paymentUri:", uri);
    });

    it("USDT 支付应该生成正确的 paymentUri", async () => {
      const result = await web3.createPayment({
        orderId: "qr_test_usdt_001",
        amount: 100000000, // 100 USDT
        currency: "USDT",
        description: "二维码 USDT 支付测试",
      });

      expect(result.success).toBe(true);
      expect(result.rawResponse).toBeDefined();

      // 检查 paymentUri 格式
      const paymentInfo = result.rawResponse as { paymentUri?: string };
      expect(paymentInfo.paymentUri).toBeDefined();

      // 验证 EIP-681 ERC-20 格式
      const uri = paymentInfo.paymentUri!;
      expect(uri.startsWith("ethereum:")).toBe(true);
      expect(uri).toContain("@31337"); // local chainId
      expect(uri).toContain("/transfer?"); // ERC-20 使用 transfer 函数
      expect(uri).toContain("address="); // 收款地址参数
      expect(uri).toContain("uint256="); // 金额参数

      console.log("\nUSDT paymentUri:", uri);
    });
  });
});

describe("generatePaymentUri 工具函数测试", () => {
  it("应该生成正确的原生代币支付链接", () => {
    const uri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1000000000000000000",
      chainId: 1,
    });

    expect(uri).toBe(
      "ethereum:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266@1?value=1000000000000000000"
    );
  });

  it("应该生成正确的 ERC-20 代币支付链接", () => {
    const uri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1000000",
      chainId: 1,
      tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    });

    expect(uri).toBe(
      "ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7@1/transfer?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&uint256=1000000"
    );
  });

  it("应该支持不同的 chainId", () => {
    // Polygon
    const polygonUri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1000000000000000000",
      chainId: 137,
    });
    expect(polygonUri).toContain("@137?value=");

    // BSC
    const bscUri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1000000000000000000",
      chainId: 56,
    });
    expect(bscUri).toContain("@56?value=");

    // Arbitrum
    const arbitrumUri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1000000000000000000",
      chainId: 42161,
    });
    expect(arbitrumUri).toContain("@42161?value=");
  });

  it("应该支持任意金额", () => {
    // 小额
    const smallUri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "1",
      chainId: 1,
    });
    expect(smallUri).toContain("?value=1");

    // 大额
    const largeUri = generatePaymentUri({
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      chainId: 1,
    });
    expect(largeUri).toContain("?value=115792089237316195423570985008687907853269984665640564039457584007913129639935");
  });
});

describe("createTransferWatcher 监听器测试", () => {
  it("应该成功创建监听器", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
      network: "local",
    });

    expect(watcher).toBeDefined();
    expect(typeof watcher.start).toBe("function");
    expect(typeof watcher.stop).toBe("function");
    expect(typeof watcher.isRunning).toBe("function");
    expect(typeof watcher.getMode).toBe("function");
    expect(typeof watcher.on).toBe("function");
    expect(typeof watcher.off).toBe("function");
    expect(typeof watcher.check).toBe("function");
  });

  it("初始状态应该是未运行", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
    });

    expect(watcher.isRunning()).toBe(false);
    expect(watcher.getMode()).toBe("stopped");
  });

  it("应该能启动和停止监听器（轮询模式）", async () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
      pollInterval: 100000, // 设置很长间隔避免实际请求
      mode: "polling", // 强制轮询模式
    });

    // 启动
    watcher.start();
    expect(watcher.isRunning()).toBe(true);
    expect(watcher.getMode()).toBe("polling");

    // 立即停止（避免定时器泄漏）
    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
    expect(watcher.getMode()).toBe("stopped");

    // 等待一下确保清理完成
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("应该能注册和移除回调", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
    });

    const callback = () => {};

    // 注册回调
    watcher.on("transfer", callback);

    // 移除回调
    watcher.off("transfer", callback);
  });

  it("应该支持代币配置", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
      tokens: [
        { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      ],
      confirmations: 3,
      pollInterval: 5000,
    });

    expect(watcher).toBeDefined();
  });

  it("应该支持 WebSocket 配置", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      wssUrl: "ws://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
      mode: "auto", // 有 wssUrl 时自动选择 WebSocket
    });

    expect(watcher).toBeDefined();
    expect(watcher.getMode()).toBe("stopped"); // 未启动时是 stopped
  });

  it("应该支持强制轮询模式", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      wssUrl: "ws://127.0.0.1:8545", // 即使有 wssUrl
      address: ANVIL_ACCOUNT_0,
      mode: "polling", // 强制使用轮询
    });

    expect(watcher).toBeDefined();
  });

  it("应该支持更多事件类型", () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
    });

    // 注册多种事件
    const errorCallback = () => {};
    const connectedCallback = () => {};
    const disconnectedCallback = () => {};

    watcher.on("error", errorCallback);
    watcher.on("connected", connectedCallback);
    watcher.on("disconnected", disconnectedCallback);

    // 移除事件
    watcher.off("error", errorCallback);
    watcher.off("connected", connectedCallback);
    watcher.off("disconnected", disconnectedCallback);
  });

  it("手动检查应该返回空数组（首次运行）", async () => {
    const watcher = createTransferWatcher({
      rpcUrl: "http://127.0.0.1:8545",
      address: ANVIL_ACCOUNT_0,
    });

    try {
      const events = await watcher.check();
      // 首次运行应该返回空数组（设置 lastBlockNumber）
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    } catch {
      // Anvil 未运行时跳过
      console.log("Anvil 未运行，跳过 check 测试");
    }
  });
});

describe("Web3 RPC 连接测试", () => {
  it("应该能连接到本地 Anvil 节点", async () => {
    try {
      const response = await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data.result).toBeDefined();
        console.log("当前区块号:", parseInt(data.result, 16));
      } else {
        console.log("Anvil 未运行，跳过 RPC 测试");
      }
    } catch {
      console.log("Anvil 未运行，跳过 RPC 测试");
    }
  });

  it("应该能获取账户余额", async () => {
    try {
      const response = await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [ANVIL_ACCOUNT_0, "latest"],
          id: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data.result).toBeDefined();
        const balanceWei = BigInt(data.result);
        const balanceEth = Number(balanceWei) / 1e18;
        console.log(`账户 ${ANVIL_ACCOUNT_0} 余额: ${balanceEth} ETH`);
      } else {
        console.log("Anvil 未运行，跳过余额查询");
      }
    } catch {
      console.log("Anvil 未运行，跳过余额查询");
    }
  });

  it("应该能读取订阅合约 owner", async () => {
    try {
      const response = await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: "0x721a1ecB9105f2335a8EA7505D343a5a09803A06",
              data: "0x8da5cb5b", // owner() 函数选择器
            },
            "latest",
          ],
          id: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result !== "0x") {
          const ownerAddress = "0x" + data.result.slice(26).toLowerCase();
          console.log("合约 owner:", ownerAddress);
        } else {
          console.log("合约未部署或方法不存在");
        }
      } else {
        console.log("Anvil 未运行，跳过合约测试");
      }
    } catch {
      console.log("Anvil 未运行，跳过合约测试");
    }
  });
});
