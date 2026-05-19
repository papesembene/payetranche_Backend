import { PayoutStatus, Prisma, SubscriptionPlan } from "@prisma/client";
import {
  ListAdminPayoutsInput,
  UpdateAdminPlanInput,
} from "../schemas/admin.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";
import { PayoutService } from "./payout.service";

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getPublicUrl = () =>
  (process.env.PUBLIC_API_URL || process.env.APP_URL || "").replace(/\/$/, "");

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

export class AdminService {
  private payoutService = new PayoutService();

  async overview() {
    const [
      tenants,
      activeTenants,
      users,
      clients,
      proUsers,
      completedSubscriptionPayments,
      pendingSubscriptionPayments,
      subscriptionRevenue,
      pendingPayouts,
      processingPayouts,
      failedPayouts,
      pendingPayoutAmount,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.client.count({ where: { isActive: true } }),
      prisma.user.count({ where: { plan: SubscriptionPlan.PRO } }),
      prisma.subscriptionPayment.count({ where: { status: "COMPLETED" } }),
      prisma.subscriptionPayment.count({ where: { status: "PENDING" } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.sellerPayout.count({ where: { status: PayoutStatus.PENDING } }),
      prisma.sellerPayout.count({ where: { status: PayoutStatus.PROCESSING } }),
      prisma.sellerPayout.count({ where: { status: PayoutStatus.FAILED } }),
      prisma.sellerPayout.aggregate({
        where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        _sum: { netAmount: true },
      }),
    ]);

    return {
      tenants,
      activeTenants,
      disabledTenants: tenants - activeTenants,
      users,
      clients,
      proUsers,
      completedSubscriptionPayments,
      pendingSubscriptionPayments,
      subscriptionRevenue: subscriptionRevenue._sum.amount || 0,
      pendingPayouts,
      processingPayouts,
      failedPayouts,
      pendingPayoutAmount: pendingPayoutAmount._sum.netAmount || 0,
    };
  }

  async listTenants(search?: string) {
    const where: Prisma.TenantWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              users: {
                some: {
                  OR: [
                    { email: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {};

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            plan: true,
            planExpiresAt: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        subscriptionPayments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            clients: true,
            credits: true,
            payments: true,
            subscriptionPayments: true,
          },
        },
      },
    });

    return tenants.map((tenant) => ({
      ...tenant,
      owner: tenant.users.find((user) => user.role === "OWNER") || tenant.users[0],
      latestSubscriptionPayment: tenant.subscriptionPayments[0] || null,
    }));
  }

  async getTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            plan: true,
            planExpiresAt: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        subscriptionPayments: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        payoutProfiles: true,
        _count: {
          select: {
            clients: true,
            credits: true,
            payments: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    return tenant;
  }

  async updateTenantStatus(tenantId: string, isActive: boolean) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        isActive,
        disabledAt: isActive ? null : new Date(),
      },
    });

    return tenant;
  }

  async updateUserPlan(userId: string, input: UpdateAdminPlanInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const planExpiresAt =
      input.plan === SubscriptionPlan.GRATUIT
        ? null
        : input.planExpiresAt
          ? new Date(input.planExpiresAt)
          : addDays(new Date(), 30);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        plan: input.plan,
        planExpiresAt,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        phone: true,
        plan: true,
        planExpiresAt: true,
        role: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async listSubscriptionPayments() {
    return prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            plan: true,
          },
        },
      },
    });
  }

  async paymentConfig() {
    const publicApiUrl = getPublicUrl();
    const frontendUrl = getFrontendUrl();
    const paytechEnv = process.env.PAYTECH_ENV || "test";
    const paytechConfigured = Boolean(
      process.env.PAYTECH_API_KEY && process.env.PAYTECH_API_SECRET
    );
    const autoPayoutsEnabled =
      process.env.PAYTECH_AUTO_PAYOUTS_ENABLED === "true";
    const publicApiIsHttps = publicApiUrl.startsWith("https://");
    const isProd = paytechEnv === "prod";

    const warnings: string[] = [];

    if (!paytechConfigured) {
      warnings.push("Clés PayTech manquantes.");
    }

    if (!publicApiUrl) {
      warnings.push("PUBLIC_API_URL manquant.");
    }

    if (isProd && publicApiUrl && !publicApiIsHttps) {
      warnings.push("PUBLIC_API_URL doit être en HTTPS en production.");
    }

    if (!isProd) {
      warnings.push("PayTech est encore en mode test.");
    }

    if (autoPayoutsEnabled && !isProd) {
      warnings.push(
        "Reversement automatique activé mais ignoré tant que PayTech n’est pas en production."
      );
    }

    const canReceivePayments =
      paytechConfigured && Boolean(publicApiUrl) && (!isProd || publicApiIsHttps);
    const canAutoPayout =
      canReceivePayments && isProd && autoPayoutsEnabled && publicApiIsHttps;

    const urls = publicApiUrl
      ? {
          health: `${publicApiUrl}/api/health`,
          clientPaymentIpn: `${publicApiUrl}/api/paytech/ipn`,
          clientPaymentSuccess: `${publicApiUrl}/api/paytech/redirect/success`,
          clientPaymentCancel: `${publicApiUrl}/api/paytech/redirect/cancel`,
          subscriptionIpn: `${publicApiUrl}/api/subscription/ipn`,
          subscriptionSuccess: `${publicApiUrl}/api/subscription/redirect/success`,
          subscriptionCancel: `${publicApiUrl}/api/subscription/redirect/cancel`,
          payoutCallback: `${publicApiUrl}/api/paytech/transfer-callback`,
        }
      : null;

    return {
      paytech: {
        environment: paytechEnv,
        configured: paytechConfigured,
        autoPayoutsEnabled,
      },
      urls,
      publicApiUrl: publicApiUrl || null,
      frontendUrl,
      readiness: {
        canReceivePayments,
        canAutoPayout,
        productionReady:
          isProd && paytechConfigured && publicApiIsHttps && Boolean(publicApiUrl),
        warnings,
      },
    };
  }

  async listPayouts(filters: ListAdminPayoutsInput = {}) {
    const where: Prisma.SellerPayoutWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { phone: { contains: filters.search, mode: "insensitive" } },
        { holderName: { contains: filters.search, mode: "insensitive" } },
        {
          tenant: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          client: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    return prisma.sellerPayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            isActive: true,
            users: {
              where: { role: "OWNER" },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                plan: true,
              },
              take: 1,
            },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
          },
        },
        externalPayment: {
          select: {
            id: true,
            refCommand: true,
            providerMethod: true,
            providerToken: true,
            paidAt: true,
          },
        },
      },
    });
  }

  async syncPayout(payoutId: string) {
    const payout = await prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      select: { id: true, tenantId: true },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    return this.payoutService.syncPayoutTransferStatus(
      payout.tenantId,
      payout.id
    );
  }

  async sendPayout(payoutId: string) {
    const payout = await prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      select: { id: true, tenantId: true },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    return this.payoutService.initiatePayoutTransfer(
      payout.tenantId,
      payout.id
    );
  }
}
