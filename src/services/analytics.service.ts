import { ClientStatus, CreditStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";

export class AnalyticsService {
  async getDashboardMetrics(tenantId: string) {
    const [creditTotals, riskClientsCount, clientsWithDebt, overdueCreditsCount, overdueTotals] =
      await Promise.all([
        prisma.credit.aggregate({
          where: {
            tenantId,
            status: { not: CreditStatus.ANNULE },
          },
          _sum: {
            amount: true,
            paidAmount: true,
            remainingAmount: true,
          },
          _count: true,
        }),
        prisma.client.count({
          where: {
            tenantId,
            status: { in: [ClientStatus.RISQUE, ClientStatus.MAUVAIS] },
          },
        }),
        prisma.credit.groupBy({
          by: ["clientId"],
          where: {
            tenantId,
            remainingAmount: { gt: 0 },
            status: { not: CreditStatus.ANNULE },
            client: {
              isActive: true,
            },
          },
        }),
        prisma.credit.count({
          where: {
            tenantId,
            status: CreditStatus.EN_RETARD,
          },
        }),
        prisma.credit.aggregate({
          where: {
            tenantId,
            status: CreditStatus.EN_RETARD,
          },
          _sum: {
            remainingAmount: true,
          },
        }),
      ]);

    const totalDebts = creditTotals._sum.amount ?? 0;
    const totalRecovered = creditTotals._sum.paidAmount ?? 0;
    const remainingToRecover = creditTotals._sum.remainingAmount ?? 0;
    const recoveryRate =
      totalDebts > 0 ? Number(((totalRecovered / totalDebts) * 100).toFixed(2)) : 0;

    return {
      totalDebts,
      totalRecovered,
      remainingToRecover,
      recoveryRate,
      riskClientsCount,
      activeClientsCount: clientsWithDebt.length,
      clientsWithDebtCount: clientsWithDebt.length,
      overdueCreditsCount,
      overdueAmount: overdueTotals._sum.remainingAmount ?? 0,
      creditsCount: creditTotals._count,
    };
  }
}
