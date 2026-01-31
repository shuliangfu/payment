#!/usr/bin/env -S deno run -A

/**
 * @title 添加支持代币脚本
 * 使用: deno run -A bin/test.ts
 */

import { Web3 } from "@dreamer/foundry";

async function main() {
  const web3 = new Web3("PaymentSubscription");

  let input: string | null = null;

  while (!input || input.trim() === "") {
    input = prompt("请输入代币地址: ");
  }

  const result = await web3.call("addSupportedToken", [input.trim()]);

  if (result.success) {
    console.log("添加成功");
  } else {
    console.log("添加失败");
  }
}

if (import.meta.main) {
  await main();
}
