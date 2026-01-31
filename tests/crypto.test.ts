/**
 * @fileoverview 加密工具测试
 */

import { describe, it, expect } from "@dreamer/test";
import {
  hmacSign,
  hmacVerify,
  timingSafeEqual,
  verifyStripeWebhook,
  generateNonceStr,
  getTimestamp,
  formatAlipayDate,
} from "../src/crypto.ts";

describe("加密工具测试", () => {
  describe("HMAC 签名", () => {
    it("应该能生成 HMAC-SHA256 签名", async () => {
      const signature = await hmacSign("test data", "secret");
      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBe(64); // SHA256 输出 32 字节 = 64 十六进制字符
    });

    it("相同数据和密钥应该生成相同签名", async () => {
      const sig1 = await hmacSign("test data", "secret");
      const sig2 = await hmacSign("test data", "secret");
      expect(sig1).toBe(sig2);
    });

    it("不同数据应该生成不同签名", async () => {
      const sig1 = await hmacSign("test data 1", "secret");
      const sig2 = await hmacSign("test data 2", "secret");
      expect(sig1).not.toBe(sig2);
    });

    it("不同密钥应该生成不同签名", async () => {
      const sig1 = await hmacSign("test data", "secret1");
      const sig2 = await hmacSign("test data", "secret2");
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("HMAC 验证", () => {
    it("应该验证正确的签名", async () => {
      const signature = await hmacSign("test data", "secret");
      const isValid = await hmacVerify("test data", signature, "secret");
      expect(isValid).toBe(true);
    });

    it("应该拒绝错误的签名", async () => {
      const isValid = await hmacVerify("test data", "wrong_signature", "secret");
      expect(isValid).toBe(false);
    });

    it("应该拒绝错误的数据", async () => {
      const signature = await hmacSign("test data", "secret");
      const isValid = await hmacVerify("wrong data", signature, "secret");
      expect(isValid).toBe(false);
    });
  });

  describe("恒定时间比较", () => {
    it("相同字符串应该返回 true", () => {
      expect(timingSafeEqual("abc", "abc")).toBe(true);
      expect(timingSafeEqual("", "")).toBe(true);
    });

    it("不同字符串应该返回 false", () => {
      expect(timingSafeEqual("abc", "abd")).toBe(false);
      expect(timingSafeEqual("abc", "ab")).toBe(false);
    });

    it("长度不同应该返回 false", () => {
      expect(timingSafeEqual("abc", "abcd")).toBe(false);
    });
  });

  describe("Stripe Webhook 验证", () => {
    it("应该拒绝无效格式的签名", async () => {
      const isValid = await verifyStripeWebhook(
        "payload",
        "invalid_signature",
        "whsec_test",
      );
      expect(isValid).toBe(false);
    });

    it("应该拒绝过期的时间戳", async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 分钟前
      const signature = `t=${oldTimestamp},v1=fake_signature`;
      const isValid = await verifyStripeWebhook(
        "payload",
        signature,
        "whsec_test",
        300, // 5 分钟容差
      );
      expect(isValid).toBe(false);
    });

    it("应该验证正确的签名", async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = '{"type":"test"}';
      const secret = "whsec_test_secret";
      const signedPayload = `${timestamp}.${payload}`;

      // 生成正确的签名
      const expectedSig = await hmacSign(signedPayload, secret);
      const signature = `t=${timestamp},v1=${expectedSig}`;

      const isValid = await verifyStripeWebhook(payload, signature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe("随机字符串生成", () => {
    it("应该生成指定长度的随机字符串", () => {
      const str16 = generateNonceStr(16);
      const str32 = generateNonceStr(32);
      const str64 = generateNonceStr(64);

      expect(str16.length).toBe(16);
      expect(str32.length).toBe(32);
      expect(str64.length).toBe(64);
    });

    it("默认生成 32 位字符串", () => {
      const str = generateNonceStr();
      expect(str.length).toBe(32);
    });

    it("每次生成的字符串应该不同", () => {
      const str1 = generateNonceStr();
      const str2 = generateNonceStr();
      expect(str1).not.toBe(str2);
    });

    it("应该只包含字母数字字符", () => {
      const str = generateNonceStr(100);
      expect(/^[A-Za-z0-9]+$/.test(str)).toBe(true);
    });
  });

  describe("时间戳", () => {
    it("应该返回秒级时间戳", () => {
      const ts = getTimestamp();
      expect(typeof ts).toBe("number");
      expect(ts).toBeGreaterThan(0);
      // 应该是秒级，不是毫秒级
      expect(ts).toBeLessThan(10000000000);
    });

    it("应该返回当前时间附近的值", () => {
      const ts = getTimestamp();
      const now = Math.floor(Date.now() / 1000);
      expect(Math.abs(ts - now)).toBeLessThan(2);
    });
  });

  describe("支付宝日期格式化", () => {
    it("应该格式化为 yyyy-MM-dd HH:mm:ss", () => {
      const date = new Date("2026-01-15T10:30:45");
      const formatted = formatAlipayDate(date);
      expect(formatted).toBe("2026-01-15 10:30:45");
    });

    it("应该正确补零", () => {
      const date = new Date("2026-01-05T08:05:09");
      const formatted = formatAlipayDate(date);
      expect(formatted).toBe("2026-01-05 08:05:09");
    });

    it("默认使用当前时间", () => {
      const formatted = formatAlipayDate();
      // 应该是有效的日期格式
      expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(formatted)).toBe(true);
    });
  });
});
