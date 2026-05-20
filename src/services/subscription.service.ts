import crypto from "crypto";
import {
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { PLAN_FEATURES, PLAN_LIMITS } from "../utils/subscriptionPlans";
import { AppError } from "../utils/AppError";
import { CreateSubscriptionCheckoutInput } from "../schemas/subscription.schema";

type PaytechWebhookPayload = {
  type_event?: string;
  ref_command?: string;
  item_price?: string | number;
  final_item_price?: string | number;
  token?: string;
  payment_method?: string;
  api_key_sha256?: string;
  api_secret_sha256?: string;
  hmac_compute?: string;
  [key: string]: unknown;
};

const PAYTECH_BASE_URL = "https://paytech.sn/api";
const SUBSCRIPTION_PERIOD_DAYS = 30;
const getPublicUrl = () => (process.env.PUBLIC_API_URL || process.env.APP_URL || "").replace(/\/$/, "");

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.GRATUIT]: 0,
  [SubscriptionPlan.PRO]: 3000,
  [SubscriptionPlan.ENTREPRISE]: 50000,
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export class SubscriptionService {
  async getCurrentPlan(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        plan: true,
        planExpiresAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const effectivePlan = this.getEffectivePlan(user.plan, user.planExpiresAt);
    if (effectivePlan !== user.plan) {
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: effectivePlan, planExpiresAt: null },
      });
      user.plan = effectivePlan;
      user.planExpiresAt = null;
    }

    const clientsCount = await prisma.client.count({
      where: { tenantId, isActive: true },
    });

    return {
      user,
      plan: user.plan,
      status: this.getPlanStatus(user.plan, user.planExpiresAt),
      price: PLAN_PRICES[user.plan],
      planExpiresAt: user.planExpiresAt,
      limits: PLAN_LIMITS[user.plan],
      features: PLAN_FEATURES[user.plan],
      usage: {
        clients: clientsCount,
      },
    };
  }

  async updatePlan(userId: string, tenantId: string, plan: SubscriptionPlan) {
    if (plan !== SubscriptionPlan.GRATUIT) {
      throw new AppError("Paid plans must be activated through PayTech checkout", 403);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { plan, planExpiresAt: null },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        plan: true,
        planExpiresAt: true,
      },
    });

    if (user.tenantId !== tenantId) {
      throw new AppError("User not found", 404);
    }

    return this.getCurrentPlan(user.id, tenantId);
  }

  async createCheckout(
    userId: string,
    tenantId: string,
    input: CreateSubscriptionCheckoutInput
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.plan !== SubscriptionPlan.PRO) {
      throw new AppError("Only Pro checkout is available online", 400);
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    const amount = PLAN_PRICES[input.plan];
    const refCommand = `SUB-${Date.now()}-${tenantId.slice(-8)}`;
    const publicUrl = getPublicUrl();

    if (!publicUrl) {
      throw new AppError("PUBLIC_API_URL must be configured for PayTech redirects", 503);
    }

    const requestBody = {
      item_name: `Abonnement PayTranche ${input.plan}`,
      item_price: amount,
      currency: "XOF",
      ref_command: refCommand,
      command_name: `Abonnement ${input.plan} - ${user.tenant.name}`,
      env: process.env.PAYTECH_ENV || "test",
      target_payment: input.targetPayment,
      ipn_url: `${publicUrl}/api/subscription/ipn`,
      success_url: `${publicUrl}/api/subscription/redirect/success?tab=subscription&payment=success&ref=${encodeURIComponent(refCommand)}`,
      cancel_url: `${publicUrl}/api/subscription/redirect/cancel?tab=subscription&payment=cancel&ref=${encodeURIComponent(refCommand)}`,
      custom_field: JSON.stringify({
        type: "subscription",
        tenantId,
        userId,
        plan: input.plan,
      }),
    };

    const subscriptionPayment = await prisma.subscriptionPayment.create({
      data: {
        tenantId,
        userId,
        plan: input.plan,
        amount,
        refCommand,
        targetPayment: input.targetPayment,
        rawRequest: requestBody,
      },
    });

    const response = await fetch(`${PAYTECH_BASE_URL}/payment/request-payment`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: JSON.stringify(requestBody),
    });

    const paytechResponse = (await response.json().catch(() => null)) as {
      success?: number;
      token?: string;
      redirect_url?: string;
      redirectUrl?: string;
      message?: string;
    } | null;

    if (!response.ok || paytechResponse?.success !== 1) {
      await prisma.subscriptionPayment.update({
        where: { id: subscriptionPayment.id },
        data: {
          status: SubscriptionPaymentStatus.FAILED,
          rawResponse: paytechResponse ?? { status: response.status },
        },
      });

      throw new AppError(
        paytechResponse?.message || "Unable to create subscription payment",
        502
      );
    }

    const updated = await prisma.subscriptionPayment.update({
      where: { id: subscriptionPayment.id },
      data: {
        status: SubscriptionPaymentStatus.PENDING,
        providerToken: paytechResponse.token,
        redirectUrl: paytechResponse.redirect_url || paytechResponse.redirectUrl,
        rawResponse: paytechResponse,
      },
    });

    return {
      id: updated.id,
      refCommand: updated.refCommand,
      status: updated.status,
      plan: updated.plan,
      amount: updated.amount,
      currency: updated.currency,
      redirectUrl: updated.redirectUrl,
      token: updated.providerToken,
    };
  }

  async getPayment(tenantId: string, id: string) {
    const payment = await prisma.subscriptionPayment.findFirst({
      where: { id, tenantId },
    });

    if (!payment) {
      throw new AppError("Subscription payment not found", 404);
    }

    return payment;
  }

  async listPayments(tenantId: string) {
    return prisma.subscriptionPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async handleIpn(payload: PaytechWebhookPayload) {
    this.verifyWebhook(payload);

    const refCommand = payload.ref_command;
    if (!refCommand) {
      throw new AppError("Missing ref_command", 400);
    }

    const subscriptionPayment = await prisma.subscriptionPayment.findUnique({
      where: { refCommand },
    });

    if (!subscriptionPayment) {
      throw new AppError("Subscription payment not found", 404);
    }

    if (payload.type_event === "sale_canceled") {
      await prisma.subscriptionPayment.update({
        where: { id: subscriptionPayment.id },
        data: {
          status: SubscriptionPaymentStatus.CANCELLED,
          providerToken: payload.token || subscriptionPayment.providerToken,
          rawWebhook: payload as Prisma.InputJsonObject,
        },
      });
      return { processed: true, status: SubscriptionPaymentStatus.CANCELLED };
    }

    if (payload.type_event !== "sale_complete") {
      return { processed: false, status: subscriptionPayment.status };
    }

    if (subscriptionPayment.status === SubscriptionPaymentStatus.COMPLETED) {
      return { processed: true, status: subscriptionPayment.status };
    }

    const paidAt = new Date();
    const user = await prisma.user.findFirst({
      where: {
        id: subscriptionPayment.userId,
        tenantId: subscriptionPayment.tenantId,
      },
    });

    if (!user) {
      throw new AppError("Subscription user not found", 404);
    }

    const currentExpiry =
      user.plan === subscriptionPayment.plan &&
      user.planExpiresAt &&
      user.planExpiresAt > paidAt
        ? user.planExpiresAt
        : paidAt;
    const periodEnd = addDays(currentExpiry, SUBSCRIPTION_PERIOD_DAYS);

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.update({
        where: { id: subscriptionPayment.id },
        data: {
          status: SubscriptionPaymentStatus.COMPLETED,
          providerToken: payload.token || subscriptionPayment.providerToken,
          rawWebhook: payload as Prisma.InputJsonObject,
          paidAt,
          periodStart: paidAt,
          periodEnd,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          plan: subscriptionPayment.plan,
          planExpiresAt: periodEnd,
        },
      });
    });

    return { processed: true, status: SubscriptionPaymentStatus.COMPLETED };
  }

  private getEffectivePlan(plan: SubscriptionPlan, expiresAt?: Date | null) {
    if (plan === SubscriptionPlan.GRATUIT) return plan;
    if (!expiresAt || expiresAt > new Date()) return plan;
    return SubscriptionPlan.GRATUIT;
  }

  private getPlanStatus(plan: SubscriptionPlan, expiresAt?: Date | null) {
    if (plan === SubscriptionPlan.GRATUIT) return "free";
    if (!expiresAt) return "active";
    return expiresAt > new Date() ? "active" : "expired";
  }

  private verifyWebhook(payload: PaytechWebhookPayload) {
    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    if (payload.hmac_compute) {
      const amount = payload.final_item_price || payload.item_price;
      const message = `${amount}|${payload.ref_command}|${apiKey}`;
      const expected = crypto
        .createHmac("sha256", apiSecret)
        .update(message)
        .digest("hex");

      const expectedBuffer = Buffer.from(expected);
      const receivedBuffer = Buffer.from(payload.hmac_compute);

      if (
        expectedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        throw new AppError("Invalid PayTech HMAC", 403);
      }
      return;
    }

    const expectedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
    const expectedSecret = crypto
      .createHash("sha256")
      .update(apiSecret)
      .digest("hex");

    if (
      payload.api_key_sha256 !== expectedKey ||
      payload.api_secret_sha256 !== expectedSecret
    ) {
      throw new AppError("Invalid PayTech signature", 403);
    }
  }
}
