/**
 * @module @dreamer/payment/currency
 *
 * 多币种转换服务
 *
 * 提供汇率获取和货币转换功能，支持多个汇率提供者
 *
 * @example
 * ```typescript
 * import { CurrencyConverter, createOpenExchangeRatesProvider } from "@dreamer/payment";
 *
 * const converter = new CurrencyConverter({
 *   provider: createOpenExchangeRatesProvider("your-api-key"),
 *   cacheTTL: 3600000, // 1小时缓存
 * });
 *
 * const result = await converter.convert({
 *   amount: 10000,
 *   from: "USD",
 *   to: "CNY",
 * });
 * ```
 */

import type {
  CurrencyConversionRequest,
  CurrencyConversionResult,
  ExchangeRate,
  ExchangeRateProvider,
} from "./types.ts";

// ============================================================================
// 汇率缓存
// ============================================================================

/**
 * 汇率缓存条目
 */
interface CacheEntry {
  /** 汇率 */
  rate: ExchangeRate;
  /** 过期时间 */
  expiresAt: number;
}

/**
 * 汇率缓存
 */
class RateCache {
  /** 缓存存储 */
  private cache: Map<string, CacheEntry> = new Map();
  /** 缓存 TTL（毫秒） */
  private ttl: number;

  /**
   * 创建缓存实例
   * @param ttl - 缓存 TTL（毫秒，默认 1 小时）
   */
  constructor(ttl: number = 3600000) {
    this.ttl = ttl;
  }

  /**
   * 生成缓存键
   * @param from - 源货币
   * @param to - 目标货币
   * @returns 缓存键
   */
  private getKey(from: string, to: string): string {
    return `${from.toUpperCase()}_${to.toUpperCase()}`;
  }

  /**
   * 获取缓存的汇率
   * @param from - 源货币
   * @param to - 目标货币
   * @returns 汇率信息或 null
   */
  get(from: string, to: string): ExchangeRate | null {
    const key = this.getKey(from, to);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.rate;
  }

  /**
   * 设置缓存的汇率
   * @param rate - 汇率信息
   */
  set(rate: ExchangeRate): void {
    const key = this.getKey(rate.from, rate.to);
    this.cache.set(key, {
      rate,
      expiresAt: Date.now() + this.ttl,
    });
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// 汇率提供者实现
// ============================================================================

/**
 * Open Exchange Rates 提供者配置
 */
export interface OpenExchangeRatesConfig {
  /** API Key */
  apiKey: string;
  /** 基础 URL */
  baseUrl?: string;
}

/**
 * 创建 Open Exchange Rates 汇率提供者
 *
 * @param config - 配置
 * @returns 汇率提供者
 *
 * @see https://openexchangerates.org/
 */
export function createOpenExchangeRatesProvider(
  config: OpenExchangeRatesConfig | string,
): ExchangeRateProvider {
  const { apiKey, baseUrl = "https://openexchangerates.org/api" } =
    typeof config === "string" ? { apiKey: config } : config;

  return {
    name: "openexchangerates",

    async getRate(from: string, to: string): Promise<ExchangeRate | null> {
      try {
        // Open Exchange Rates 免费版只支持 USD 作为基准货币
        const response = await fetch(
          `${baseUrl}/latest.json?app_id=${apiKey}&symbols=${from.toUpperCase()},${to.toUpperCase()}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json() as {
          rates: Record<string, number>;
          timestamp: number;
        };

        const fromRate = data.rates[from.toUpperCase()] || 1;
        const toRate = data.rates[to.toUpperCase()];

        if (!toRate) {
          return null;
        }

        // 计算汇率：from -> to
        const rate = toRate / fromRate;

        return {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate,
          updatedAt: new Date(data.timestamp * 1000),
        };
      } catch {
        return null;
      }
    },

    async getRates(
      baseCurrency: string,
      targetCurrencies: string[],
    ): Promise<Map<string, ExchangeRate>> {
      const rates = new Map<string, ExchangeRate>();

      try {
        const symbols = [baseCurrency, ...targetCurrencies].join(",").toUpperCase();
        const response = await fetch(
          `${baseUrl}/latest.json?app_id=${apiKey}&symbols=${symbols}`,
        );

        if (!response.ok) {
          return rates;
        }

        const data = await response.json() as {
          rates: Record<string, number>;
          timestamp: number;
        };

        const baseRate = data.rates[baseCurrency.toUpperCase()] || 1;
        const updatedAt = new Date(data.timestamp * 1000);

        for (const target of targetCurrencies) {
          const targetRate = data.rates[target.toUpperCase()];
          if (targetRate) {
            const rate: ExchangeRate = {
              from: baseCurrency.toUpperCase(),
              to: target.toUpperCase(),
              rate: targetRate / baseRate,
              updatedAt,
            };
            rates.set(target.toUpperCase(), rate);
          }
        }
      } catch {
        // 忽略错误
      }

      return rates;
    },
  };
}

/**
 * ExchangeRate-API 提供者配置
 */
export interface ExchangeRateApiConfig {
  /** API Key */
  apiKey: string;
  /** 基础 URL */
  baseUrl?: string;
}

/**
 * 创建 ExchangeRate-API 汇率提供者
 *
 * @param config - 配置
 * @returns 汇率提供者
 *
 * @see https://www.exchangerate-api.com/
 */
export function createExchangeRateApiProvider(
  config: ExchangeRateApiConfig | string,
): ExchangeRateProvider {
  const { apiKey, baseUrl = "https://v6.exchangerate-api.com/v6" } =
    typeof config === "string" ? { apiKey: config } : config;

  return {
    name: "exchangerate-api",

    async getRate(from: string, to: string): Promise<ExchangeRate | null> {
      try {
        const response = await fetch(
          `${baseUrl}/${apiKey}/pair/${from.toUpperCase()}/${to.toUpperCase()}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json() as {
          conversion_rate: number;
          time_last_update_unix: number;
        };

        return {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: data.conversion_rate,
          updatedAt: new Date(data.time_last_update_unix * 1000),
        };
      } catch {
        return null;
      }
    },

    async getRates(
      baseCurrency: string,
      targetCurrencies: string[],
    ): Promise<Map<string, ExchangeRate>> {
      const rates = new Map<string, ExchangeRate>();

      try {
        const response = await fetch(
          `${baseUrl}/${apiKey}/latest/${baseCurrency.toUpperCase()}`,
        );

        if (!response.ok) {
          return rates;
        }

        const data = await response.json() as {
          conversion_rates: Record<string, number>;
          time_last_update_unix: number;
        };

        const updatedAt = new Date(data.time_last_update_unix * 1000);

        for (const target of targetCurrencies) {
          const rate = data.conversion_rates[target.toUpperCase()];
          if (rate) {
            rates.set(target.toUpperCase(), {
              from: baseCurrency.toUpperCase(),
              to: target.toUpperCase(),
              rate,
              updatedAt,
            });
          }
        }
      } catch {
        // 忽略错误
      }

      return rates;
    },
  };
}

/**
 * 固定汇率提供者（用于测试或固定汇率场景）
 */
export interface FixedRatesConfig {
  /** 固定汇率映射（如 { "USD_CNY": 7.2, "EUR_USD": 1.1 }） */
  rates: Record<string, number>;
}

/**
 * 创建固定汇率提供者
 *
 * @param config - 配置
 * @returns 汇率提供者
 */
export function createFixedRatesProvider(config: FixedRatesConfig): ExchangeRateProvider {
  const { rates } = config;

  return {
    name: "fixed",

    async getRate(from: string, to: string): Promise<ExchangeRate | null> {
      await Promise.resolve(); // 满足 async 要求
      const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
      const rate = rates[key];

      if (rate === undefined) {
        // 尝试反向汇率
        const reverseKey = `${to.toUpperCase()}_${from.toUpperCase()}`;
        const reverseRate = rates[reverseKey];
        if (reverseRate !== undefined) {
          return {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            rate: 1 / reverseRate,
            updatedAt: new Date(),
          };
        }
        return null;
      }

      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate,
        updatedAt: new Date(),
      };
    },

    async getRates(
      baseCurrency: string,
      targetCurrencies: string[],
    ): Promise<Map<string, ExchangeRate>> {
      await Promise.resolve(); // 满足 async 要求
      const result = new Map<string, ExchangeRate>();

      for (const target of targetCurrencies) {
        const key = `${baseCurrency.toUpperCase()}_${target.toUpperCase()}`;
        const rate = rates[key];

        if (rate !== undefined) {
          result.set(target.toUpperCase(), {
            from: baseCurrency.toUpperCase(),
            to: target.toUpperCase(),
            rate,
            updatedAt: new Date(),
          });
        }
      }

      return result;
    },
  };
}

// ============================================================================
// 货币转换器
// ============================================================================

/**
 * 货币转换器配置
 */
export interface CurrencyConverterConfig {
  /** 汇率提供者 */
  provider: ExchangeRateProvider;
  /** 缓存 TTL（毫秒，默认 1 小时） */
  cacheTTL?: number;
  /** 备用提供者 */
  fallbackProvider?: ExchangeRateProvider;
}

/**
 * 货币转换器
 *
 * 提供货币转换功能，支持缓存和备用提供者
 */
export class CurrencyConverter {
  /** 主要汇率提供者 */
  private provider: ExchangeRateProvider;
  /** 备用汇率提供者 */
  private fallbackProvider?: ExchangeRateProvider;
  /** 汇率缓存 */
  private cache: RateCache;

  /**
   * 创建货币转换器
   * @param config - 配置
   */
  constructor(config: CurrencyConverterConfig) {
    this.provider = config.provider;
    this.fallbackProvider = config.fallbackProvider;
    this.cache = new RateCache(config.cacheTTL);
  }

  /**
   * 获取汇率
   *
   * @param from - 源货币
   * @param to - 目标货币
   * @returns 汇率信息
   */
  async getRate(from: string, to: string): Promise<ExchangeRate | null> {
    // 相同货币
    if (from.toUpperCase() === to.toUpperCase()) {
      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: 1,
        updatedAt: new Date(),
      };
    }

    // 检查缓存
    const cached = this.cache.get(from, to);
    if (cached) {
      return cached;
    }

    // 从提供者获取
    let rate = await this.provider.getRate(from, to);

    // 尝试备用提供者
    if (!rate && this.fallbackProvider) {
      rate = await this.fallbackProvider.getRate(from, to);
    }

    // 缓存结果
    if (rate) {
      this.cache.set(rate);
    }

    return rate;
  }

  /**
   * 转换货币
   *
   * @param request - 转换请求
   * @returns 转换结果
   */
  async convert(request: CurrencyConversionRequest): Promise<CurrencyConversionResult> {
    const { amount, from, to } = request;

    // 相同货币
    if (from.toUpperCase() === to.toUpperCase()) {
      return {
        success: true,
        originalAmount: amount,
        convertedAmount: amount,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: 1,
        rateUpdatedAt: new Date(),
      };
    }

    // 获取汇率
    const rate = await this.getRate(from, to);

    if (!rate) {
      return {
        success: false,
        originalAmount: amount,
        convertedAmount: 0,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: 0,
        rateUpdatedAt: new Date(),
        error: `无法获取 ${from} 到 ${to} 的汇率`,
      };
    }

    // 计算转换金额（保留整数，单位：分）
    const convertedAmount = Math.round(amount * rate.rate);

    return {
      success: true,
      originalAmount: amount,
      convertedAmount,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: rate.rate,
      rateUpdatedAt: rate.updatedAt,
    };
  }

  /**
   * 批量转换货币
   *
   * @param amount - 金额（单位：分）
   * @param from - 源货币
   * @param targets - 目标货币列表
   * @returns 转换结果映射
   */
  async convertToMultiple(
    amount: number,
    from: string,
    targets: string[],
  ): Promise<Map<string, CurrencyConversionResult>> {
    const results = new Map<string, CurrencyConversionResult>();

    // 获取所有汇率
    const rates = await this.provider.getRates(from, targets);

    // 缓存所有汇率
    for (const rate of rates.values()) {
      this.cache.set(rate);
    }

    // 转换每个目标货币
    for (const target of targets) {
      const result = await this.convert({ amount, from, to: target });
      results.set(target.toUpperCase(), result);
    }

    return results;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get cacheSize(): number {
    return this.cache.size;
  }
}

/**
 * 创建货币转换器的便捷函数
 *
 * @param config - 配置
 * @returns 货币转换器实例
 */
export function createCurrencyConverter(
  config: CurrencyConverterConfig,
): CurrencyConverter {
  return new CurrencyConverter(config);
}

// ============================================================================
// 常用货币代码
// ============================================================================

/**
 * 常用法定货币
 */
export const FIAT_CURRENCIES = {
  USD: { code: "USD", name: "美元", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", name: "欧元", symbol: "€", decimals: 2 },
  GBP: { code: "GBP", name: "英镑", symbol: "£", decimals: 2 },
  CNY: { code: "CNY", name: "人民币", symbol: "¥", decimals: 2 },
  JPY: { code: "JPY", name: "日元", symbol: "¥", decimals: 0 },
  KRW: { code: "KRW", name: "韩元", symbol: "₩", decimals: 0 },
  HKD: { code: "HKD", name: "港币", symbol: "HK$", decimals: 2 },
  TWD: { code: "TWD", name: "新台币", symbol: "NT$", decimals: 2 },
  SGD: { code: "SGD", name: "新加坡元", symbol: "S$", decimals: 2 },
  AUD: { code: "AUD", name: "澳元", symbol: "A$", decimals: 2 },
  CAD: { code: "CAD", name: "加元", symbol: "C$", decimals: 2 },
  CHF: { code: "CHF", name: "瑞士法郎", symbol: "CHF", decimals: 2 },
  INR: { code: "INR", name: "印度卢比", symbol: "₹", decimals: 2 },
  RUB: { code: "RUB", name: "俄罗斯卢布", symbol: "₽", decimals: 2 },
  BRL: { code: "BRL", name: "巴西雷亚尔", symbol: "R$", decimals: 2 },
} as const;

/**
 * 格式化货币金额
 *
 * @param amount - 金额（单位：分）
 * @param currency - 货币代码
 * @returns 格式化后的金额字符串
 */
export function formatCurrency(amount: number, currency: string): string {
  const currencyInfo = FIAT_CURRENCIES[currency.toUpperCase() as keyof typeof FIAT_CURRENCIES];
  const decimals = currencyInfo?.decimals ?? 2;
  const symbol = currencyInfo?.symbol ?? currency;

  // 转换为主单位
  const mainAmount = amount / Math.pow(10, decimals);

  // 格式化
  return `${symbol}${mainAmount.toFixed(decimals)}`;
}
