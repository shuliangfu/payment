/**
 * @fileoverview 货币转换工具示例
 *
 * @example 运行示例
 * ```bash
 * deno run -A examples/currency.ts
 * ```
 */

import {
  createCurrencyConverter,
  createFixedRatesProvider,
  formatCurrency,
  FIAT_CURRENCIES,
} from "../src/mod.ts";

async function main() {
  console.log("=== 货币转换工具示例 ===\n");

  // 创建固定汇率提供者
  // 格式: { "FROM_TO": rate }
  const provider = createFixedRatesProvider({
    rates: {
      "USD_CNY": 7.2,
      "USD_EUR": 0.92,
      "USD_JPY": 150,
      "CNY_USD": 0.139,
    },
  });

  // 创建转换器
  const converter = createCurrencyConverter({ provider });

  // 单次转换
  console.log("--- 货币转换 ---");
  const result = await converter.convert({
    amount: 100,
    from: "USD",
    to: "CNY",
  });
  if (result.success) {
    console.log(`100 USD = ${result.convertedAmount} CNY`);
    console.log(`汇率: ${result.rate}`);
  }

  // 相同货币
  const sameResult = await converter.convert({
    amount: 100,
    from: "USD",
    to: "USD",
  });
  console.log(`100 USD = ${sameResult.convertedAmount} USD (相同货币)`);

  // 货币格式化
  console.log("\n--- 货币格式化 ---");
  console.log("美元:", formatCurrency(1234.56, "USD"));
  console.log("人民币:", formatCurrency(1234.56, "CNY"));
  console.log("欧元:", formatCurrency(1234.56, "EUR"));
  console.log("日元:", formatCurrency(1234, "JPY"));

  // 货币信息
  console.log("\n--- 支持的货币 ---");
  const currencies = Object.keys(FIAT_CURRENCIES).slice(0, 5);
  for (const code of currencies) {
    const info = FIAT_CURRENCIES[code as keyof typeof FIAT_CURRENCIES];
    console.log(`  ${code}: ${info.name} (${info.symbol})`);
  }

  console.log("\n示例完成");
}

main().catch(console.error);
