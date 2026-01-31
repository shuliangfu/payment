/**
 * @module @dreamer/plugins/payment/adapters/stripe
 *
 * Stripe 支付适配器
 *
 * 提供 Stripe 支付集成，支持：
 * - 创建支付意图 (Payment Intent)
 * - 处理 Webhook 回调
 * - 查询支付状态
 * - 退款处理
 *
 * @see https://stripe.com/docs/api
 */

import {
  createDefaultLogger,
  type CreateSubscriptionRequest,
  type Logger,
  type LoggerOptions,
  type NotifyData,
  type NotifyResponse,
  type PaymentOrderInfo,
  type PaymentResponse,
  type PaymentStatusResponse,
  type RefundRequest,
  type RefundResponse,
  type Subscription,
  type SubscriptionPaymentAdapter,
  type SubscriptionPlan,
  type SubscriptionResponse,
} from "../types.ts";
import { verifyStripeWebhook } from "../crypto.ts";

/**
 * Stripe 配置选项
 */
export interface StripeConfig {
  /** Stripe 公钥 (pk_xxx) */
  publicKey: string;
  /** Stripe 私钥 (sk_xxx) */
  secretKey: string;
  /** Webhook 签名密钥 (whsec_xxx) */
  webhookSecret?: string;
  /** API 版本 */
  apiVersion?: string;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * Stripe API 基础 URL
 */
const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * 创建 Stripe 适配器
 *
 * @param config - Stripe 配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createStripeAdapter } from "@dreamer/plugins/payment/adapters/stripe";
 *
 * const stripe = createStripeAdapter({
 *   publicKey: "pk_test_xxx",
 *   secretKey: "sk_test_xxx",
 *   webhookSecret: "whsec_xxx",
 * });
 *
 * // 创建支付
 * const result = await stripe.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "USD",
 * });
 * ```
 */
export function createStripeAdapter(config: StripeConfig): SubscriptionPaymentAdapter {
  const {
    publicKey,
    secretKey,
    webhookSecret,
    apiVersion = "2023-10-16",
    logging = {},
  } = config;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "Stripe",
    logger: customLogger,
  } = logging;

  // 创建日志器
  const logger: Logger = customLogger || createDefaultLogger({
    enabled: logEnabled,
    level: logLevel,
    prefix: logPrefix,
  });

  /**
   * 日志输出
   */
  const log = (message: string, data?: unknown) => {
    if (logEnabled) {
      logger.debug(`[${logPrefix}] ${message}`, data);
    }
  };

  /**
   * 发送 Stripe API 请求
   */
  const stripeRequest = async (
    endpoint: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> => {
    const url = `${STRIPE_API_BASE}${endpoint}`;
    const headers = new Headers({
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": apiVersion,
    });

    // 转换为 URL 编码格式
    const formBody = body
      ? Object.entries(body)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
      : undefined;

    const response = await fetch(url, {
      method,
      headers,
      body: formBody,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || "Stripe API 请求失败");
    }

    return result;
  };

  /**
   * 验证 Webhook 签名（异步版本）
   *
   * 使用 HMAC-SHA256 验证 Stripe Webhook 签名
   *
   * @param payload - 请求体原始字符串
   * @param signature - Stripe-Signature 头
   * @returns 是否验证通过
   */
  const verifyWebhookSignatureAsync = async (
    payload: string,
    signature: string,
  ): Promise<boolean> => {
    if (!webhookSecret) {
      log("警告：未配置 webhookSecret，跳过签名验证");
      return true;
    }

    try {
      const isValid = await verifyStripeWebhook(payload, signature, webhookSecret);
      log("Webhook 签名验证结果", { isValid });
      return isValid;
    } catch (error) {
      log("签名验证失败", error);
      return false;
    }
  };

  return {
    name: "stripe",
    version: "1.0.0",

    /**
     * 创建支付
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      log("创建 Stripe 支付", order);

      try {
        // 创建 Payment Intent
        const paymentIntent = (await stripeRequest("/payment_intents", "POST", {
          amount: order.amount,
          currency: (order.currency || "usd").toLowerCase(),
          description: order.description,
          metadata: JSON.stringify({
            orderId: order.orderId,
            ...order.metadata,
          }),
          automatic_payment_methods: JSON.stringify({ enabled: true }),
        })) as {
          id: string;
          client_secret: string;
          status: string;
        };

        log("Payment Intent 创建成功", paymentIntent);

        return {
          success: true,
          transactionId: paymentIntent.id,
          paymentToken: paymentIntent.client_secret,
          rawResponse: paymentIntent,
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建 Stripe 支付失败",
          errorCode: "STRIPE_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      log("查询支付状态", transactionId);

      try {
        const paymentIntent = (await stripeRequest(
          `/payment_intents/${transactionId}`,
          "GET",
        )) as {
          id: string;
          status: string;
          amount: number;
          currency: string;
          created: number;
        };

        // 转换 Stripe 状态到通用状态
        const statusMap: Record<string, PaymentStatusResponse["status"]> = {
          requires_payment_method: "pending",
          requires_confirmation: "pending",
          requires_action: "pending",
          processing: "pending",
          succeeded: "completed",
          canceled: "cancelled",
          requires_capture: "pending",
        };

        return {
          success: true,
          status: statusMap[paymentIntent.status] || "pending",
          paid: paymentIntent.status === "succeeded",
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency.toUpperCase(),
          paidAt: paymentIntent.status === "succeeded"
            ? new Date(paymentIntent.created * 1000)
            : undefined,
          rawResponse: paymentIntent,
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
     * 处理 Webhook 回调
     */
    async handleNotify(data: NotifyData): Promise<NotifyResponse> {
      log("处理 Stripe Webhook", data.body);

      try {
        const signature = data.headers.get("stripe-signature") || "";
        const payload = typeof data.body === "string"
          ? data.body
          : JSON.stringify(data.body);

        // 验证签名（使用 HMAC-SHA256）
        const isValid = await verifyWebhookSignatureAsync(payload, signature);
        if (!isValid) {
          return {
            success: false,
            error: "Webhook 签名验证失败",
          };
        }

        const event = typeof data.body === "string"
          ? JSON.parse(data.body)
          : data.body;

        // 处理不同事件类型
        switch (event.type) {
          case "payment_intent.succeeded": {
            const paymentIntent = event.data.object;
            const metadata = paymentIntent.metadata || {};

            return {
              success: true,
              orderId: metadata.orderId,
              transactionId: paymentIntent.id,
              status: "completed",
              amount: paymentIntent.amount,
              currency: paymentIntent.currency.toUpperCase(),
              platformResponse: JSON.stringify({ received: true }),
            };
          }

          case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            const metadata = paymentIntent.metadata || {};

            return {
              success: true,
              orderId: metadata.orderId,
              transactionId: paymentIntent.id,
              status: "failed",
              error: paymentIntent.last_payment_error?.message,
              platformResponse: JSON.stringify({ received: true }),
            };
          }

          default:
            log("未处理的事件类型", event.type);
            return {
              success: true,
              platformResponse: JSON.stringify({ received: true }),
            };
        }
      } catch (error) {
        log("处理 Webhook 失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "处理 Webhook 失败",
        };
      }
    },

    /**
     * 申请退款
     */
    async refund(request: RefundRequest): Promise<RefundResponse> {
      log("申请退款", request);

      try {
        const refundData: Record<string, unknown> = {
          payment_intent: request.transactionId,
        };

        if (request.amount) {
          refundData.amount = request.amount;
        }

        if (request.reason) {
          refundData.reason = request.reason;
        }

        const refund = (await stripeRequest("/refunds", "POST", refundData)) as {
          id: string;
          status: string;
        };

        return {
          success: true,
          refundId: refund.id,
          status: refund.status === "succeeded" ? "completed" : "pending",
          rawResponse: refund,
        };
      } catch (error) {
        log("退款失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "退款失败",
        };
      }
    },

    /**
     * 验证配置
     */
    validateConfig(): boolean {
      if (!publicKey || !publicKey.startsWith("pk_")) {
        log("配置验证失败：无效的 publicKey");
        return false;
      }
      if (!secretKey || !secretKey.startsWith("sk_")) {
        log("配置验证失败：无效的 secretKey");
        return false;
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      return {
        publicKey,
        apiVersion,
      };
    },

    // ========== 订阅支付功能 ==========

    /**
     * 创建订阅计划（Stripe 中称为 Price）
     *
     * @param plan - 计划信息
     * @returns 创建结果
     */
    async createPlan(plan: SubscriptionPlan): Promise<{ success: boolean; planId?: string; error?: string }> {
      log("创建订阅计划", plan);

      try {
        // 首先创建 Product
        const product = (await stripeRequest("/products", "POST", {
          name: plan.name,
          description: plan.description,
          metadata: JSON.stringify({ planId: plan.id }),
        })) as { id: string };

        // 间隔映射（类型已经是 day/week/month/year）
        const intervalMap: Record<string, string> = {
          day: "day",
          week: "week",
          month: "month",
          year: "year",
        };

        // 创建 Price（订阅价格）
        const price = (await stripeRequest("/prices", "POST", {
          product: product.id,
          unit_amount: plan.amount,
          currency: (plan.currency || "usd").toLowerCase(),
          recurring: JSON.stringify({
            interval: intervalMap[plan.interval] || "month",
            interval_count: plan.intervalCount || 1,
          }),
        })) as { id: string };

        log("订阅计划创建成功", { productId: product.id, priceId: price.id });

        return {
          success: true,
          planId: price.id,
        };
      } catch (error) {
        log("创建订阅计划失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建订阅计划失败",
        };
      }
    },

    /**
     * 创建订阅
     *
     * @param request - 订阅请求
     * @returns 订阅结果
     */
    async createSubscription(request: CreateSubscriptionRequest): Promise<SubscriptionResponse> {
      log("创建订阅", request);

      try {
        const subscriptionData: Record<string, unknown> = {
          customer: request.customerId,
          items: JSON.stringify([{ price: request.planId }]),
        };

        // 设置支付方式
        if (request.paymentMethodId) {
          subscriptionData.default_payment_method = request.paymentMethodId;
        }

        // 设置试用期
        if (request.metadata?.trialDays) {
          subscriptionData.trial_period_days = request.metadata.trialDays;
        }

        // 设置元数据
        if (request.metadata) {
          subscriptionData.metadata = JSON.stringify(request.metadata);
        }

        const subscription = (await stripeRequest("/subscriptions", "POST", subscriptionData)) as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          canceled_at: number | null;
          cancel_at_period_end: boolean;
          trial_end: number | null;
          created: number;
          items: { data: Array<{ price: { id: string } }> };
          metadata: Record<string, unknown>;
        };

        log("订阅创建成功", subscription);

        // 转换状态
        const statusMap: Record<string, Subscription["status"]> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
          paused: "paused",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.customer,
            planId: subscription.items.data[0]?.price.id || request.planId,
            status: statusMap[subscription.status] || "active",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
            createdAt: new Date(subscription.created * 1000),
            metadata: subscription.metadata,
            rawResponse: subscription,
          },
          rawResponse: subscription,
        };
      } catch (error) {
        log("创建订阅失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建订阅失败",
        };
      }
    },

    /**
     * 取消订阅
     *
     * @param subscriptionId - 订阅 ID
     * @param immediately - 是否立即取消
     * @returns 操作结果
     */
    async cancelSubscription(subscriptionId: string, immediately = false): Promise<SubscriptionResponse> {
      log("取消订阅", { subscriptionId, immediately });

      try {
        let subscription;

        if (immediately) {
          // 立即取消
          subscription = (await stripeRequest(
            `/subscriptions/${subscriptionId}`,
            "DELETE",
          )) as {
            id: string;
            customer: string;
            status: string;
            current_period_start: number;
            current_period_end: number;
            canceled_at: number | null;
            cancel_at_period_end: boolean;
            trial_end: number | null;
            created: number;
            items: { data: Array<{ price: { id: string } }> };
          };
        } else {
          // 在周期结束时取消
          subscription = (await stripeRequest(
            `/subscriptions/${subscriptionId}`,
            "POST",
            { cancel_at_period_end: "true" },
          )) as {
            id: string;
            customer: string;
            status: string;
            current_period_start: number;
            current_period_end: number;
            canceled_at: number | null;
            cancel_at_period_end: boolean;
            trial_end: number | null;
            created: number;
            items: { data: Array<{ price: { id: string } }> };
          };
        }

        log("订阅取消成功", subscription);

        const statusMap: Record<string, Subscription["status"]> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
          paused: "paused",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.customer,
            planId: subscription.items.data[0]?.price.id || "",
            status: statusMap[subscription.status] || "canceled",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
            createdAt: new Date(subscription.created * 1000),
            rawResponse: subscription,
          },
          rawResponse: subscription,
        };
      } catch (error) {
        log("取消订阅失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "取消订阅失败",
        };
      }
    },

    /**
     * 暂停订阅
     *
     * @param subscriptionId - 订阅 ID
     * @returns 操作结果
     */
    async pauseSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
      log("暂停订阅", subscriptionId);

      try {
        // Stripe 通过 pause_collection 暂停订阅
        const subscription = (await stripeRequest(
          `/subscriptions/${subscriptionId}`,
          "POST",
          { pause_collection: JSON.stringify({ behavior: "void" }) },
        )) as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          canceled_at: number | null;
          cancel_at_period_end: boolean;
          trial_end: number | null;
          created: number;
          items: { data: Array<{ price: { id: string } }> };
        };

        log("订阅暂停成功", subscription);

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.customer,
            planId: subscription.items.data[0]?.price.id || "",
            status: "paused",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
            createdAt: new Date(subscription.created * 1000),
            rawResponse: subscription,
          },
          rawResponse: subscription,
        };
      } catch (error) {
        log("暂停订阅失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "暂停订阅失败",
        };
      }
    },

    /**
     * 恢复订阅
     *
     * @param subscriptionId - 订阅 ID
     * @returns 操作结果
     */
    async resumeSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
      log("恢复订阅", subscriptionId);

      try {
        // 移除暂停状态
        const subscription = (await stripeRequest(
          `/subscriptions/${subscriptionId}`,
          "POST",
          { pause_collection: "" },
        )) as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          canceled_at: number | null;
          cancel_at_period_end: boolean;
          trial_end: number | null;
          created: number;
          items: { data: Array<{ price: { id: string } }> };
        };

        log("订阅恢复成功", subscription);

        const statusMap: Record<string, Subscription["status"]> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
          paused: "paused",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.customer,
            planId: subscription.items.data[0]?.price.id || "",
            status: statusMap[subscription.status] || "active",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
            createdAt: new Date(subscription.created * 1000),
            rawResponse: subscription,
          },
          rawResponse: subscription,
        };
      } catch (error) {
        log("恢复订阅失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "恢复订阅失败",
        };
      }
    },

    /**
     * 查询订阅状态
     *
     * @param subscriptionId - 订阅 ID
     * @returns 订阅信息
     */
    async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
      log("查询订阅", subscriptionId);

      try {
        const subscription = (await stripeRequest(
          `/subscriptions/${subscriptionId}`,
          "GET",
        )) as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number;
          current_period_end: number;
          canceled_at: number | null;
          cancel_at_period_end: boolean;
          trial_end: number | null;
          created: number;
          items: { data: Array<{ price: { id: string } }> };
          metadata: Record<string, unknown>;
        };

        log("查询订阅成功", subscription);

        const statusMap: Record<string, Subscription["status"]> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
          paused: "paused",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.customer,
            planId: subscription.items.data[0]?.price.id || "",
            status: statusMap[subscription.status] || "active",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : undefined,
            createdAt: new Date(subscription.created * 1000),
            metadata: subscription.metadata,
            rawResponse: subscription,
          },
          rawResponse: subscription,
        };
      } catch (error) {
        log("查询订阅失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "查询订阅失败",
        };
      }
    },

    /**
     * 获取客户的所有订阅
     *
     * @param customerId - 客户 ID
     * @returns 订阅列表
     */
    async listSubscriptions(customerId: string): Promise<{ success: boolean; subscriptions?: Subscription[]; error?: string }> {
      log("获取客户订阅列表", customerId);

      try {
        const result = (await stripeRequest(
          `/subscriptions?customer=${customerId}`,
          "GET",
        )) as {
          data: Array<{
            id: string;
            customer: string;
            status: string;
            current_period_start: number;
            current_period_end: number;
            canceled_at: number | null;
            cancel_at_period_end: boolean;
            trial_end: number | null;
            created: number;
            items: { data: Array<{ price: { id: string } }> };
            metadata: Record<string, unknown>;
          }>;
        };

        log("获取订阅列表成功", { count: result.data.length });

        const statusMap: Record<string, Subscription["status"]> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
          paused: "paused",
        };

        const subscriptions: Subscription[] = result.data.map((sub) => ({
          id: sub.id,
          customerId: sub.customer,
          planId: sub.items.data[0]?.price.id || "",
          status: statusMap[sub.status] || "active",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          canceledAt: sub.canceled_at
            ? new Date(sub.canceled_at * 1000)
            : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialEnd: sub.trial_end
            ? new Date(sub.trial_end * 1000)
            : undefined,
          createdAt: new Date(sub.created * 1000),
          metadata: sub.metadata,
          rawResponse: sub,
        }));

        return {
          success: true,
          subscriptions,
        };
      } catch (error) {
        log("获取订阅列表失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取订阅列表失败",
        };
      }
    },
  };
}

// 导出默认工厂函数
export default createStripeAdapter;
