import {
  AlertChannel,
  AlertStatus,
  AlertType,
  ClientStatus,
  CreditStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { getNotificationChannel } from "./notificationChannel.service";

const OVERDUE_GRACE_DAYS = 3;
const RISK_OVERDUE_THRESHOLD = 2;

export class NotificationService {
  async listAlerts(
    tenantId: string,
    filters: {
      status?: AlertStatus;
      type?: AlertType;
      clientId?: string;
    } = {}
  ) {
    const where: Prisma.AlertWhereInput = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    return prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        credit: true,
      },
    });
  }

  async markAsRead(tenantId: string, alertId: string) {
    const alert = await prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new AppError("Alert not found", 404);
    }

    return prisma.alert.update({
      where: { id: alert.id },
      data: { status: AlertStatus.READ },
    });
  }

  async scanOverduePayments(tenantId: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - OVERDUE_GRACE_DAYS);

    const overdueCredits = await prisma.credit.findMany({
      where: {
        tenantId,
        dueDate: { lt: cutoffDate },
        remainingAmount: { gt: 0 },
        status: { notIn: [CreditStatus.PAYE, CreditStatus.ANNULE] },
      },
      include: { client: true },
    });

    let overdueAlertsCreated = 0;
    let riskAlertsCreated = 0;

    for (const credit of overdueCredits) {
      await prisma.credit.update({
        where: { id: credit.id },
        data: { status: CreditStatus.EN_RETARD },
      });

      const alert = await this.createAlertIfMissing({
        tenantId,
        clientId: credit.clientId,
        creditId: credit.id,
        type: AlertType.CREDIT_OVERDUE,
        title: "Paiement en retard",
        message: `${credit.client.name} a un crédit en retard de plus de ${OVERDUE_GRACE_DAYS} jours.`,
        metadata: {
          dueDate: credit.dueDate,
          remainingAmount: credit.remainingAmount,
          overdueGraceDays: OVERDUE_GRACE_DAYS,
        },
      });

      if (alert.created) {
        overdueAlertsCreated += 1;
      }
    }

    const riskyClients = await prisma.credit.groupBy({
      by: ["clientId"],
      where: {
        tenantId,
        status: CreditStatus.EN_RETARD,
        remainingAmount: { gt: 0 },
      },
      _count: { clientId: true },
      having: {
        clientId: {
          _count: {
            gte: RISK_OVERDUE_THRESHOLD,
          },
        },
      },
    });

    for (const item of riskyClients) {
      const client = await prisma.client.update({
        where: { id: item.clientId },
        data: { status: ClientStatus.RISQUE },
      });

      const alert = await this.createAlertIfMissing({
        tenantId,
        clientId: client.id,
        type: AlertType.CLIENT_RISK,
        title: "Client à risque",
        message: `${client.name} a plusieurs paiements en retard.`,
        metadata: {
          overdueCreditsCount: item._count.clientId,
          riskOverdueThreshold: RISK_OVERDUE_THRESHOLD,
        },
      });

      if (alert.created) {
        riskAlertsCreated += 1;
      }
    }

    return {
      overdueCreditsDetected: overdueCredits.length,
      overdueAlertsCreated,
      riskClientsDetected: riskyClients.length,
      riskAlertsCreated,
    };
  }

  private async createAlertIfMissing(input: {
    tenantId: string;
    clientId?: string;
    creditId?: string;
    type: AlertType;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
    channel?: AlertChannel;
  }) {
    const existing = await prisma.alert.findFirst({
      where: {
        tenantId: input.tenantId,
        type: input.type,
        clientId: input.clientId,
        creditId: input.creditId,
        status: { not: AlertStatus.READ },
      },
    });

    if (existing) {
      return { alert: existing, created: false };
    }

    const alert = await prisma.alert.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        creditId: input.creditId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
        channel: input.channel ?? AlertChannel.IN_APP,
      },
    });

    await getNotificationChannel(alert.channel).send(alert);

    return { alert, created: true };
  }
}
