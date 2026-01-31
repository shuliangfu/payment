/**
 * @fileoverview 货币转换测试
 */

import { describe, it, expect } from "@dreamer/test";
import {
  CurrencyConverter,
  createCurrencyConverter,
  createFixedRatesProvider,
  formatCurrency,
  FIAT_CURRENCIES,
} from "../src/currency.ts";

describe("货币转换测试", () => {
  describe("固定汇率提供者", () => {
    it("应该能创建固定汇率提供者", () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
          "EUR_USD": 1.1,
        },
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe("fixed");
    });

    it("应该能获取固定汇率", async () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
          "EUR_USD": 1.1,
        },
      });

      const rate = await provider.getRate("USD", "CNY");
      expect(rate).toBeDefined();
      expect(rate!.from).toBe("USD");
      expect(rate!.to).toBe("CNY");
      expect(rate!.rate).toBe(7.2);
    });

    it("应该能计算反向汇率", async () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
        },
      });

      const rate = await provider.getRate("CNY", "USD");
      expect(rate).toBeDefined();
      expect(rate!.from).toBe("CNY");
      expect(rate!.to).toBe("USD");
      expect(rate!.rate).toBeCloseTo(1 / 7.2, 5);
    });

    it("应该对不存在的货币对返回 null", async () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
        },
      });

      const rate = await provider.getRate("GBP", "JPY");
      expect(rate).toBeNull();
    });

    it("应该能批量获取汇率", async () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
          "USD_EUR": 0.9,
          "USD_GBP": 0.8,
        },
      });

      const rates = await provider.getRates("USD", ["CNY", "EUR", "GBP", "JPY"]);
      expect(rates.size).toBe(3);
      expect(rates.get("CNY")?.rate).toBe(7.2);
      expect(rates.get("EUR")?.rate).toBe(0.9);
      expect(rates.get("GBP")?.rate).toBe(0.8);
    });
  });

  describe("货币转换器", () => {
    it("应该能创建转换器", () => {
      const provider = createFixedRatesProvider({
        rates: { "USD_CNY": 7.2 },
      });

      const converter = new CurrencyConverter({ provider });
      expect(converter).toBeDefined();
    });

    it("应该能使用便捷函数创建", () => {
      const provider = createFixedRatesProvider({
        rates: { "USD_CNY": 7.2 },
      });

      const converter = createCurrencyConverter({ provider });
      expect(converter).toBeDefined();
    });

    it("应该能转换货币", async () => {
      const provider = createFixedRatesProvider({
        rates: { "USD_CNY": 7.2 },
      });

      const converter = new CurrencyConverter({ provider });
      const result = await converter.convert({
        amount: 10000, // 100 USD（分）
        from: "USD",
        to: "CNY",
      });

      expect(result.success).toBe(true);
      expect(result.originalAmount).toBe(10000);
      expect(result.convertedAmount).toBe(72000); // 720 CNY
      expect(result.from).toBe("USD");
      expect(result.to).toBe("CNY");
      expect(result.rate).toBe(7.2);
    });

    it("相同货币应该返回相同金额", async () => {
      const provider = createFixedRatesProvider({
        rates: {},
      });

      const converter = new CurrencyConverter({ provider });
      const result = await converter.convert({
        amount: 10000,
        from: "USD",
        to: "USD",
      });

      expect(result.success).toBe(true);
      expect(result.originalAmount).toBe(10000);
      expect(result.convertedAmount).toBe(10000);
      expect(result.rate).toBe(1);
    });

    it("应该缓存汇率", async () => {
      const provider = createFixedRatesProvider({
        rates: { "USD_CNY": 7.2 },
      });

      const converter = new CurrencyConverter({ provider, cacheTTL: 60000 });

      // 第一次调用
      await converter.getRate("USD", "CNY");
      expect(converter.cacheSize).toBe(1);

      // 第二次调用应该使用缓存
      await converter.getRate("USD", "CNY");
      expect(converter.cacheSize).toBe(1);
    });

    it("应该能清除缓存", async () => {
      const provider = createFixedRatesProvider({
        rates: { "USD_CNY": 7.2 },
      });

      const converter = new CurrencyConverter({ provider });
      await converter.getRate("USD", "CNY");
      expect(converter.cacheSize).toBe(1);

      converter.clearCache();
      expect(converter.cacheSize).toBe(0);
    });

    it("应该能批量转换", async () => {
      const provider = createFixedRatesProvider({
        rates: {
          "USD_CNY": 7.2,
          "USD_EUR": 0.9,
          "USD_GBP": 0.8,
        },
      });

      const converter = new CurrencyConverter({ provider });
      const results = await converter.convertToMultiple(
        10000,
        "USD",
        ["CNY", "EUR", "GBP"],
      );

      expect(results.size).toBe(3);
      expect(results.get("CNY")?.convertedAmount).toBe(72000);
      expect(results.get("EUR")?.convertedAmount).toBe(9000);
      expect(results.get("GBP")?.convertedAmount).toBe(8000);
    });

    it("应该对无法获取汇率的情况返回错误", async () => {
      const provider = createFixedRatesProvider({
        rates: {},
      });

      const converter = new CurrencyConverter({ provider });
      const result = await converter.convert({
        amount: 10000,
        from: "USD",
        to: "CNY",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("无法获取");
    });
  });

  describe("货币格式化", () => {
    it("应该正确格式化美元", () => {
      expect(formatCurrency(10000, "USD")).toBe("$100.00");
      expect(formatCurrency(12345, "USD")).toBe("$123.45");
    });

    it("应该正确格式化人民币", () => {
      expect(formatCurrency(10000, "CNY")).toBe("¥100.00");
      expect(formatCurrency(72000, "CNY")).toBe("¥720.00");
    });

    it("应该正确格式化欧元", () => {
      expect(formatCurrency(10000, "EUR")).toBe("€100.00");
    });

    it("应该正确格式化日元（无小数）", () => {
      expect(formatCurrency(10000, "JPY")).toBe("¥10000");
    });

    it("应该对未知货币使用货币代码", () => {
      expect(formatCurrency(10000, "XYZ")).toBe("XYZ100.00");
    });
  });

  describe("货币常量", () => {
    it("应该包含常用货币", () => {
      expect(FIAT_CURRENCIES.USD).toBeDefined();
      expect(FIAT_CURRENCIES.EUR).toBeDefined();
      expect(FIAT_CURRENCIES.CNY).toBeDefined();
      expect(FIAT_CURRENCIES.JPY).toBeDefined();
    });

    it("应该包含正确的货币信息", () => {
      expect(FIAT_CURRENCIES.USD.code).toBe("USD");
      expect(FIAT_CURRENCIES.USD.name).toBe("美元");
      expect(FIAT_CURRENCIES.USD.symbol).toBe("$");
      expect(FIAT_CURRENCIES.USD.decimals).toBe(2);

      expect(FIAT_CURRENCIES.JPY.decimals).toBe(0);
    });
  });
});
