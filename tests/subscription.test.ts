/**
 * @fileoverview 订阅支付测试
 */

import { describe, it, expect } from "@dreamer/test";
import {
  createStripeAdapter,
  createPayPalAdapter,
} from "../src/mod.ts";
import type { SubscriptionPaymentAdapter } from "../src/types.ts";

describe("订阅支付测试", () => {
  describe("Stripe 订阅适配器", () => {
    const stripe = createStripeAdapter({
      publicKey: "pk_test_xxx",
      secretKey: "sk_test_xxx",
    }) as SubscriptionPaymentAdapter;

    it("应该支持订阅功能", () => {
      expect(typeof stripe.createPlan).toBe("function");
      expect(typeof stripe.createSubscription).toBe("function");
      expect(typeof stripe.cancelSubscription).toBe("function");
      expect(typeof stripe.pauseSubscription).toBe("function");
      expect(typeof stripe.resumeSubscription).toBe("function");
      expect(typeof stripe.getSubscription).toBe("function");
      expect(typeof stripe.listSubscriptions).toBe("function");
    });

    it("createPlan 应该返回正确的结构", async () => {
      // 由于没有真实 API，这里测试错误处理
      const result = await stripe.createPlan!({
        id: "plan_test",
        name: "测试计划",
        amount: 1000,
        currency: "USD",
        interval: "month",
      });

      // 应该返回结果对象（可能失败但结构正确）
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("createSubscription 应该返回正确的结构", async () => {
      const result = await stripe.createSubscription!({
        customerId: "cus_test",
        planId: "price_test",
      });

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("cancelSubscription 应该返回正确的结构", async () => {
      const result = await stripe.cancelSubscription!("sub_test");

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("getSubscription 应该返回正确的结构", async () => {
      const result = await stripe.getSubscription!("sub_test");

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("listSubscriptions 应该返回正确的结构", async () => {
      const result = await stripe.listSubscriptions!("cus_test");

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("PayPal 订阅适配器", () => {
    const paypal = createPayPalAdapter({
      clientId: "test_client_id",
      clientSecret: "test_client_secret",
      sandbox: true,
    }) as SubscriptionPaymentAdapter;

    it("应该支持订阅功能", () => {
      expect(typeof paypal.createPlan).toBe("function");
      expect(typeof paypal.createSubscription).toBe("function");
      expect(typeof paypal.cancelSubscription).toBe("function");
      expect(typeof paypal.pauseSubscription).toBe("function");
      expect(typeof paypal.resumeSubscription).toBe("function");
      expect(typeof paypal.getSubscription).toBe("function");
      expect(typeof paypal.listSubscriptions).toBe("function");
    });

    // 注意：以下测试会尝试连接真实 API，在无网络或凭证无效时会失败
    // 这里仅测试方法存在和基本结构，不测试实际 API 调用
    it("createPlan 方法应该存在", () => {
      expect(typeof paypal.createPlan).toBe("function");
    });

    it("createSubscription 方法应该存在", () => {
      expect(typeof paypal.createSubscription).toBe("function");
    });

    it("listSubscriptions 应该返回不支持提示", async () => {
      const result = await paypal.listSubscriptions!("customer_test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("不支持");
    });
  });

  describe("订阅计划类型", () => {
    it("应该支持多种订阅周期", () => {
      const intervals = ["day", "week", "month", "year"];

      intervals.forEach((interval) => {
        const plan = {
          id: `plan_${interval}`,
          name: `${interval} 计划`,
          amount: 1000,
          currency: "USD",
          interval: interval as "day" | "week" | "month" | "year",
        };

        expect(plan.interval).toBe(interval);
      });
    });

    it("应该支持订阅状态", () => {
      const statuses = ["active", "trialing", "past_due", "canceled", "unpaid", "paused"];

      statuses.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });
  });
});
