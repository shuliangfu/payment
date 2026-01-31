/**
 * @module @dreamer/plugins/payment/adapters/paypal
 *
 * PayPal 支付适配器
 *
 * 提供 PayPal 支付集成，支持：
 * - 创建订单
 * - 捕获支付
 * - 处理 Webhook 回调
 * - 退款处理
 *
 * @see https://developer.paypal.com/docs/api/overview/
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

/**
 * PayPal 配置选项
 */
export interface PayPalConfig {
  /** 客户端 ID */
  clientId: string;
  /** 客户端密钥 */
  clientSecret: string;
  /** 是否为沙箱环境 */
  sandbox?: boolean;
  /** Webhook ID（用于验证签名） */
  webhookId?: string;
  /** 日志配置 */
  logging?: LoggerOptions;
}

/**
 * PayPal API 端点
 */
const PAYPAL_ENDPOINTS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  production: "https://api-m.paypal.com",
};

/**
 * 创建 PayPal 适配器
 *
 * @param config - PayPal 配置
 * @returns 支付适配器实例
 *
 * @example
 * ```typescript
 * import { createPayPalAdapter } from "@dreamer/plugins/payment/adapters/paypal";
 *
 * const paypal = createPayPalAdapter({
 *   clientId: "xxx",
 *   clientSecret: "xxx",
 *   sandbox: true,
 * });
 *
 * // 创建支付
 * const result = await paypal.createPayment({
 *   orderId: "order_123",
 *   amount: 1000,
 *   currency: "USD",
 * });
 * ```
 */
export function createPayPalAdapter(config: PayPalConfig): SubscriptionPaymentAdapter {
  const {
    clientId,
    clientSecret,
    sandbox = false,
    webhookId: _webhookId,
    logging = {},
  } = config;

  const baseUrl = sandbox ? PAYPAL_ENDPOINTS.sandbox : PAYPAL_ENDPOINTS.production;

  // 缓存访问令牌
  let accessToken: string | null = null;
  let tokenExpiry = 0;

  // 日志配置
  const {
    enabled: logEnabled = false,
    level: logLevel = "info",
    prefix: logPrefix = "PayPal",
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
   * 获取访问令牌
   */
  const getAccessToken = async (): Promise<string> => {
    // 检查缓存的令牌是否有效
    if (accessToken && Date.now() < tokenExpiry) {
      return accessToken;
    }

    const auth = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error("获取 PayPal 访问令牌失败");
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 提前 60 秒过期

    return accessToken!;
  };

  /**
   * 发送 PayPal API 请求
   */
  const paypalRequest = async (
    endpoint: string,
    method: string,
    body?: unknown,
  ): Promise<unknown> => {
    const token = await getAccessToken();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "PayPal API 请求失败");
    }

    // 某些请求可能返回空响应
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  };

  return {
    name: "paypal",
    version: "1.0.0",

    /**
     * 创建支付
     */
    async createPayment(order: PaymentOrderInfo): Promise<PaymentResponse> {
      log("创建 PayPal 支付", order);

      try {
        const amount = (order.amount / 100).toFixed(2); // 转换为元

        const orderData = {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: order.orderId,
              description: order.description,
              amount: {
                currency_code: order.currency || "USD",
                value: amount,
              },
            },
          ],
          application_context: {
            return_url: order.returnUrl || "",
            cancel_url: order.callbackUrl || "",
            brand_name: order.productName,
            user_action: "PAY_NOW",
          },
        };

        const result = (await paypalRequest("/v2/checkout/orders", "POST", orderData)) as {
          id: string;
          status: string;
          links: Array<{ rel: string; href: string }>;
        };

        // 获取支付页面链接
        const approveLink = result.links.find((l) => l.rel === "approve");

        log("订单创建成功", result);

        return {
          success: true,
          transactionId: result.id,
          paymentUrl: approveLink?.href,
          rawResponse: result,
        };
      } catch (error) {
        log("创建支付失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "创建 PayPal 支付失败",
          errorCode: "PAYPAL_CREATE_ERROR",
        };
      }
    },

    /**
     * 查询支付状态
     */
    async queryPayment(transactionId: string): Promise<PaymentStatusResponse> {
      log("查询支付状态", transactionId);

      try {
        const order = (await paypalRequest(`/v2/checkout/orders/${transactionId}`, "GET")) as {
          id: string;
          status: string;
          purchase_units: Array<{
            amount: { value: string; currency_code: string };
            payments?: { captures?: Array<{ create_time: string }> };
          }>;
        };

        // 转换 PayPal 状态到通用状态
        const statusMap: Record<string, PaymentStatusResponse["status"]> = {
          CREATED: "pending",
          SAVED: "pending",
          APPROVED: "pending",
          VOIDED: "cancelled",
          COMPLETED: "completed",
          PAYER_ACTION_REQUIRED: "pending",
        };

        const purchaseUnit = order.purchase_units[0];
        const capture = purchaseUnit.payments?.captures?.[0];

        return {
          success: true,
          status: statusMap[order.status] || "pending",
          paid: order.status === "COMPLETED",
          transactionId: order.id,
          amount: Math.round(parseFloat(purchaseUnit.amount.value) * 100),
          currency: purchaseUnit.amount.currency_code,
          paidAt: capture ? new Date(capture.create_time) : undefined,
          rawResponse: order,
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
      log("处理 PayPal Webhook", data.body);

      try {
        const event = data.body as {
          event_type: string;
          resource: {
            id: string;
            status: string;
            purchase_units?: Array<{
              reference_id: string;
              amount: { value: string; currency_code: string };
            }>;
          };
        };

        // 处理不同事件类型
        switch (event.event_type) {
          case "CHECKOUT.ORDER.APPROVED": {
            // 订单已批准，需要捕获
            const orderId = event.resource.id;

            // 自动捕获支付
            const captureResult = await paypalRequest(
              `/v2/checkout/orders/${orderId}/capture`,
              "POST",
            );

            log("支付已捕获", captureResult);

            const purchaseUnit = event.resource.purchase_units?.[0];
            return {
              success: true,
              orderId: purchaseUnit?.reference_id,
              transactionId: orderId,
              status: "completed",
              amount: purchaseUnit
                ? Math.round(parseFloat(purchaseUnit.amount.value) * 100)
                : undefined,
              currency: purchaseUnit?.amount.currency_code,
              platformResponse: JSON.stringify({ status: "ok" }),
            };
          }

          case "PAYMENT.CAPTURE.COMPLETED": {
            const purchaseUnit = event.resource.purchase_units?.[0];
            return {
              success: true,
              orderId: purchaseUnit?.reference_id,
              transactionId: event.resource.id,
              status: "completed",
              platformResponse: JSON.stringify({ status: "ok" }),
            };
          }

          case "PAYMENT.CAPTURE.DENIED":
          case "PAYMENT.CAPTURE.REFUNDED": {
            return {
              success: true,
              transactionId: event.resource.id,
              status: event.event_type.includes("REFUNDED") ? "refunded" : "failed",
              platformResponse: JSON.stringify({ status: "ok" }),
            };
          }

          default:
            log("未处理的事件类型", event.event_type);
            return {
              success: true,
              platformResponse: JSON.stringify({ status: "ok" }),
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
        const refundData: Record<string, unknown> = {};

        if (request.amount) {
          refundData.amount = {
            value: (request.amount / 100).toFixed(2),
            currency_code: "USD", // 需要从原订单获取
          };
        }

        if (request.reason) {
          refundData.note_to_payer = request.reason;
        }

        const refund = (await paypalRequest(
          `/v2/payments/captures/${request.transactionId}/refund`,
          "POST",
          Object.keys(refundData).length > 0 ? refundData : undefined,
        )) as {
          id: string;
          status: string;
        };

        return {
          success: true,
          refundId: refund.id,
          status: refund.status === "COMPLETED" ? "completed" : "pending",
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
      if (!clientId) {
        log("配置验证失败：缺少 clientId");
        return false;
      }
      if (!clientSecret) {
        log("配置验证失败：缺少 clientSecret");
        return false;
      }
      return true;
    },

    /**
     * 获取客户端配置
     */
    getClientConfig(): Record<string, unknown> {
      return {
        clientId,
        sandbox,
        // PayPal JS SDK 配置
        sdkUrl: `https://www.paypal.com/sdk/js?client-id=${clientId}${sandbox ? "&debug=true" : ""}`,
      };
    },

    // ========== 订阅支付功能 ==========

    /**
     * 创建订阅计划
     *
     * @param plan - 计划信息
     * @returns 创建结果
     */
    async createPlan(plan: SubscriptionPlan): Promise<{ success: boolean; planId?: string; error?: string }> {
      log("创建 PayPal 订阅计划", plan);

      try {
        // 首先创建 Product
        const product = (await paypalRequest("/v1/catalogs/products", "POST", {
          name: plan.name,
          description: plan.description || plan.name,
          type: "SERVICE",
          category: "SOFTWARE",
        })) as { id: string };

        // 间隔映射（类型已经是 day/week/month/year）
        const intervalMap: Record<string, string> = {
          day: "DAY",
          week: "WEEK",
          month: "MONTH",
          year: "YEAR",
        };

        // 创建 Plan
        const paypalPlan = (await paypalRequest("/v1/billing/plans", "POST", {
          product_id: product.id,
          name: plan.name,
          description: plan.description || plan.name,
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: {
                interval_unit: intervalMap[plan.interval] || "MONTH",
                interval_count: plan.intervalCount || 1,
              },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0, // 无限循环
              pricing_scheme: {
                fixed_price: {
                  value: (plan.amount / 100).toFixed(2),
                  currency_code: plan.currency || "USD",
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            payment_failure_threshold: 3,
          },
        })) as { id: string };

        log("订阅计划创建成功", { productId: product.id, planId: paypalPlan.id });

        return {
          success: true,
          planId: paypalPlan.id,
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
      log("创建 PayPal 订阅", request);

      try {
        const subscriptionData: Record<string, unknown> = {
          plan_id: request.planId,
          application_context: {
            brand_name: "Payment App",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: request.metadata?.returnUrl || "https://example.com/success",
            cancel_url: request.metadata?.cancelUrl || "https://example.com/cancel",
          },
        };

        // 设置订阅者信息
        if (request.customerId) {
          subscriptionData.custom_id = request.customerId;
        }

        // 设置开始时间
        if (request.startDate) {
          subscriptionData.start_time = request.startDate.toISOString();
        }

        const subscription = (await paypalRequest("/v1/billing/subscriptions", "POST", subscriptionData)) as {
          id: string;
          status: string;
          status_update_time: string;
          plan_id: string;
          start_time: string;
          create_time: string;
          links: Array<{ rel: string; href: string }>;
        };

        log("订阅创建成功", subscription);

        // 获取批准链接
        const approveLink = subscription.links.find((l) => l.rel === "approve");

        // 转换状态
        const statusMap: Record<string, Subscription["status"]> = {
          APPROVAL_PENDING: "active", // 等待用户批准
          APPROVED: "active",
          ACTIVE: "active",
          SUSPENDED: "paused",
          CANCELLED: "canceled",
          EXPIRED: "canceled",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: request.customerId,
            planId: subscription.plan_id,
            status: statusMap[subscription.status] || "active",
            currentPeriodStart: new Date(subscription.start_time),
            currentPeriodEnd: new Date(subscription.start_time), // PayPal 不直接返回周期结束时间
            createdAt: new Date(subscription.create_time),
            metadata: {
              approveUrl: approveLink?.href,
            },
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
     * @param _immediately - 是否立即取消（PayPal 总是立即取消）
     * @returns 操作结果
     */
    async cancelSubscription(subscriptionId: string, _immediately = false): Promise<SubscriptionResponse> {
      log("取消 PayPal 订阅", subscriptionId);

      try {
        // PayPal 取消订阅
        await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}/cancel`,
          "POST",
          { reason: "User requested cancellation" },
        );

        // 获取更新后的订阅信息
        const subscription = (await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}`,
          "GET",
        )) as {
          id: string;
          status: string;
          plan_id: string;
          start_time: string;
          create_time: string;
          status_update_time: string;
        };

        log("订阅取消成功", subscription);

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: "",
            planId: subscription.plan_id,
            status: "canceled",
            currentPeriodStart: new Date(subscription.start_time),
            currentPeriodEnd: new Date(subscription.status_update_time),
            canceledAt: new Date(subscription.status_update_time),
            createdAt: new Date(subscription.create_time),
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
      log("暂停 PayPal 订阅", subscriptionId);

      try {
        await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}/suspend`,
          "POST",
          { reason: "User requested suspension" },
        );

        // 获取更新后的订阅信息
        const subscription = (await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}`,
          "GET",
        )) as {
          id: string;
          status: string;
          plan_id: string;
          start_time: string;
          create_time: string;
        };

        log("订阅暂停成功", subscription);

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: "",
            planId: subscription.plan_id,
            status: "paused",
            currentPeriodStart: new Date(subscription.start_time),
            currentPeriodEnd: new Date(subscription.start_time),
            createdAt: new Date(subscription.create_time),
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
      log("恢复 PayPal 订阅", subscriptionId);

      try {
        await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}/activate`,
          "POST",
          { reason: "Reactivating subscription" },
        );

        // 获取更新后的订阅信息
        const subscription = (await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}`,
          "GET",
        )) as {
          id: string;
          status: string;
          plan_id: string;
          start_time: string;
          create_time: string;
        };

        log("订阅恢复成功", subscription);

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: "",
            planId: subscription.plan_id,
            status: "active",
            currentPeriodStart: new Date(subscription.start_time),
            currentPeriodEnd: new Date(subscription.start_time),
            createdAt: new Date(subscription.create_time),
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
      log("查询 PayPal 订阅", subscriptionId);

      try {
        const subscription = (await paypalRequest(
          `/v1/billing/subscriptions/${subscriptionId}`,
          "GET",
        )) as {
          id: string;
          status: string;
          plan_id: string;
          start_time: string;
          create_time: string;
          billing_info?: {
            next_billing_time?: string;
            last_payment?: {
              time: string;
            };
          };
          custom_id?: string;
        };

        log("查询订阅成功", subscription);

        // 转换状态
        const statusMap: Record<string, Subscription["status"]> = {
          APPROVAL_PENDING: "active",
          APPROVED: "active",
          ACTIVE: "active",
          SUSPENDED: "paused",
          CANCELLED: "canceled",
          EXPIRED: "canceled",
        };

        return {
          success: true,
          subscription: {
            id: subscription.id,
            customerId: subscription.custom_id || "",
            planId: subscription.plan_id,
            status: statusMap[subscription.status] || "active",
            currentPeriodStart: subscription.billing_info?.last_payment?.time
              ? new Date(subscription.billing_info.last_payment.time)
              : new Date(subscription.start_time),
            currentPeriodEnd: subscription.billing_info?.next_billing_time
              ? new Date(subscription.billing_info.next_billing_time)
              : new Date(subscription.start_time),
            createdAt: new Date(subscription.create_time),
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
     * 获取客户的所有订阅（PayPal 不直接支持按客户查询）
     *
     * @param _customerId - 客户 ID（PayPal 需要通过其他方式查询）
     * @returns 订阅列表
     */
    listSubscriptions(_customerId: string): Promise<{ success: boolean; subscriptions?: Subscription[]; error?: string }> {
      log("获取客户订阅列表 - PayPal 不支持按客户 ID 直接查询");

      // PayPal 不支持直接按客户 ID 列出订阅
      // 需要通过 Webhook 或自己维护客户-订阅映射
      return Promise.resolve({
        success: false,
        error: "PayPal 不支持按客户 ID 直接查询订阅列表，请使用 getSubscription 单独查询",
      });
    },
  };
}

// 导出默认工厂函数
export default createPayPalAdapter;
