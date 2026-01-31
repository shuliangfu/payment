/**
 * @title MyToken 合约测试
 * @dev 测试 MyToken 代币合约的基本功能
 *
 * 使用方法:
 *   WEB3_ENV=local deno test -A tests/01-mytoken.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "@dreamer/test";
import { createWeb3, logger, type Web3 } from "@dreamer/foundry";

describe("MyToken 合约测试", () => {
  let web3: Web3;
  let deployerAddress: string;

  beforeAll(() => {
    // 创建 Web3 实例（会自动加载配置并合并参数）
    web3 = createWeb3("MyToken");

    // 获取部署者地址（账户0，Anvil 默认账户）
    deployerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  });

  afterAll(() => {
    logger.info("测试完成");
  });

  describe("合约基本信息", () => {
    it("应该能够读取代币名称", async () => {
      const name = await web3.read("name");
      expect(name).toBe("MyToken");
    });

    it("应该能够读取代币符号", async () => {
      const symbol = await web3.read("symbol");
      expect(symbol).toBe("MTK");
    });

    it("应该能够读取小数位数", async () => {
      const decimals = await web3.read("decimals");
      expect(Number(decimals)).toBe(18);
    });

    it("应该能够读取总供应量", async () => {
      const totalSupply = await web3.read("totalSupply");
      expect(totalSupply).toBeDefined();
      expect(Number(totalSupply)).toBeGreaterThan(0);
    });
  });

  describe("余额查询", () => {
    it("应该能够查询部署者余额", async () => {
      const balance = await web3.read("balanceOf", [deployerAddress]);
      expect(balance).toBeDefined();
      expect(Number(balance)).toBeGreaterThan(0);
    });
  });
});
