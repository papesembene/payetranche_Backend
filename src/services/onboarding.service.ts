import { PayoutOperator } from "@prisma/client";
import { CompleteOnboardingInput } from "../schemas/onboarding.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";

export class OnboardingService {
  async getStatus(tenantId: string, userId: string) {
    const [tenant, user, payoutProfiles] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.user.findFirst({ where: { id: userId, tenantId } }),
      prisma.sellerPayoutProfile.findMany({
        where: { tenantId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
    ]);

    if (!tenant || !user) {
      throw new AppError("Onboarding profile not found", 404);
    }

    const missing: string[] = [];
    if (!tenant.name?.trim()) missing.push("companyName");
    if (!user.phone?.trim()) missing.push("phone");
    if (payoutProfiles.length === 0) missing.push("payoutAccount");

    const isComplete = missing.length === 0;

    return {
      isComplete,
      missing,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        onboardingCompletedAt: tenant.onboardingCompletedAt,
      },
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        onboardingCompleted: isComplete,
      },
      payoutProfiles,
    };
  }

  async complete(tenantId: string, userId: string, input: CompleteOnboardingInput) {
    const defaultIndex = input.payoutAccounts.findIndex((account) => account.isDefault);
    const normalizedAccounts = input.payoutAccounts.map((account, index) => ({
      ...account,
      isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
    }));

    const uniqueOperators = new Set<PayoutOperator>();
    for (const account of normalizedAccounts) {
      if (uniqueOperators.has(account.operator)) {
        throw new AppError("Duplicate payout operator", 400);
      }
      uniqueOperators.add(account.operator);
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: input.companyName,
          onboardingCompletedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { phone: input.phone },
      });

      if (normalizedAccounts.some((account) => account.isDefault)) {
        await tx.sellerPayoutProfile.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      for (const account of normalizedAccounts) {
        await tx.sellerPayoutProfile.upsert({
          where: {
            tenantId_operator: {
              tenantId,
              operator: account.operator,
            },
          },
          create: {
            tenantId,
            operator: account.operator,
            phone: account.phone,
            holderName: account.holderName,
            isDefault: account.isDefault,
          },
          update: {
            phone: account.phone,
            holderName: account.holderName,
            isDefault: account.isDefault,
          },
        });
      }
    });

    return this.getStatus(tenantId, userId);
  }
}
