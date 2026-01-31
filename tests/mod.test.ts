/**
 * @fileoverview 支付库主模块测试
 *
 * 测试模块导出和基础功能
 */

import { describe, it, expect, beforeAll } from "@dreamer/test";

// 导入所有模块，验证导出正确
import {
  // 适配器
  createStripeAdapter,
  createPayPalAdapter,
  createAlipayAdapter,
  createWechatPayAdapter,
  createApplePayAdapter,
  createGooglePayAdapter,
  createUnionPayAdapter,
  createWeb3Adapter,
  createAdapter,
  getSupportedAdapters,
  // 货币转换
  CurrencyConverter,
  createCurrencyConverter,
  createFixedRatesProvider,
  formatCurrency,
  FIAT_CURRENCIES,
  // 对账
  PaymentReconciler,
  InMemoryTransactionStore,
  createReconciler,
  // 类型
  createDefaultLogger,
} from "../src/mod.ts";

describe("Payment 模块导出测试", () => {
  it("应该导出所有适配器创建函数", () => {
    expect(typeof createStripeAdapter).toBe("function");
    expect(typeof createPayPalAdapter).toBe("function");
    expect(typeof createAlipayAdapter).toBe("function");
    expect(typeof createWechatPayAdapter).toBe("function");
    expect(typeof createApplePayAdapter).toBe("function");
    expect(typeof createGooglePayAdapter).toBe("function");
    expect(typeof createUnionPayAdapter).toBe("function");
    expect(typeof createWeb3Adapter).toBe("function");
  });

  it("应该导出工厂函数", () => {
    expect(typeof createAdapter).toBe("function");
    expect(typeof getSupportedAdapters).toBe("function");
  });

  it("应该导出货币转换相关", () => {
    expect(typeof CurrencyConverter).toBe("function");
    expect(typeof createCurrencyConverter).toBe("function");
    expect(typeof createFixedRatesProvider).toBe("function");
    expect(typeof formatCurrency).toBe("function");
    expect(FIAT_CURRENCIES).toBeDefined();
  });

  it("应该导出对账相关", () => {
    expect(typeof PaymentReconciler).toBe("function");
    expect(typeof InMemoryTransactionStore).toBe("function");
    expect(typeof createReconciler).toBe("function");
  });

  it("应该导出日志器", () => {
    expect(typeof createDefaultLogger).toBe("function");
  });

  it("getSupportedAdapters 应该返回所有支持的适配器", () => {
    const adapters = getSupportedAdapters();
    expect(adapters).toContain("stripe");
    expect(adapters).toContain("paypal");
    expect(adapters).toContain("alipay");
    expect(adapters).toContain("wechat");
    expect(adapters).toContain("apple-pay");
    expect(adapters).toContain("google-pay");
    expect(adapters).toContain("unionpay");
    expect(adapters).toContain("web3");
    expect(adapters.length).toBe(8);
  });
});

describe("Stripe 适配器测试", () => {
  it("应该能创建适配器实例", () => {
    const adapter = createStripeAdapter({
      publicKey: "pk_test_xxx",
      secretKey: "sk_test_xxx",
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("stripe");
    expect(adapter.version).toBe("1.0.0");
  });

  it("应该验证配置", () => {
    const validAdapter = createStripeAdapter({
      publicKey: "pk_test_xxx",
      secretKey: "sk_test_xxx",
    });
    expect(validAdapter.validateConfig()).toBe(true);

    const invalidAdapter = createStripeAdapter({
      publicKey: "invalid",
      secretKey: "invalid",
    });
    expect(invalidAdapter.validateConfig()).toBe(false);
  });

  it("应该返回客户端配置", () => {
    const adapter = createStripeAdapter({
      publicKey: "pk_test_xxx",
      secretKey: "sk_test_xxx",
    });

    const clientConfig = adapter.getClientConfig();
    expect(clientConfig.publicKey).toBe("pk_test_xxx");
    expect(clientConfig.apiVersion).toBeDefined();
  });
});

describe("Web3 适配器测试", () => {
  it("应该能创建适配器实例", () => {
    const adapter = createWeb3Adapter({
      merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("web3");
    expect(adapter.version).toBe("1.0.0");
  });

  it("应该验证地址配置", () => {
    const validAdapter = createWeb3Adapter({
      merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
    });
    expect(validAdapter.validateConfig()).toBe(true);

    const invalidAdapter = createWeb3Adapter({
      merchantAddress: "invalid",
    });
    expect(invalidAdapter.validateConfig()).toBe(false);
  });

  it("应该返回客户端配置", () => {
    const adapter = createWeb3Adapter({
      merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
      networks: ["ethereum", "polygon", "bsc"],
      supportedTokens: ["ETH", "USDT", "USDC"],
    });

    const clientConfig = adapter.getClientConfig();
    expect(clientConfig.merchantAddress).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f1e888");
    expect(clientConfig.networks).toContain("ethereum");
    expect(clientConfig.networks).toContain("polygon");
    expect(clientConfig.networks).toContain("bsc");
    expect(clientConfig.supportedTokens).toContain("ETH");
    expect(clientConfig.supportedTokens).toContain("USDT");
  });

  it("应该支持多个网络", () => {
    const adapter = createWeb3Adapter({
      merchantAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1e888",
      networks: ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base"],
    });

    const clientConfig = adapter.getClientConfig();
    const chainIds = clientConfig.chainIds as Record<string, number>;

    expect(chainIds.ethereum).toBe(1);
    expect(chainIds.polygon).toBe(137);
    expect(chainIds.bsc).toBe(56);
    expect(chainIds.arbitrum).toBe(42161);
    expect(chainIds.optimism).toBe(10);
    expect(chainIds.base).toBe(8453);
  });
});

describe("工厂函数测试", () => {
  it("应该通过工厂函数创建适配器", () => {
    const stripe = createAdapter("stripe", {
      publicKey: "pk_test_xxx",
      secretKey: "sk_test_xxx",
    });

    expect(stripe).toBeDefined();
    expect(stripe.name).toBe("stripe");
  });

  it("应该对无效适配器抛出错误", () => {
    expect(() => {
      // @ts-expect-error 测试无效适配器名称
      createAdapter("invalid", {});
    }).toThrow("未知的支付适配器");
  });
});
