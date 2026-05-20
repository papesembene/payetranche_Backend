import {
  AlertChannel,
  AlertStatus,
  AlertType,
  ClientStatus,
  CreditStatus,
  InstallmentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { getNotificationChannel } from "./notificationChannel.service";

const OVERDUE_GRACE_DAYS = 3;
const RISK_OVERDUE_THRESHOLD = 2;

const startOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const endOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
};

const formatAmount = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

const daysLate = (dueDate: Date, today = new Date()) => {
  const diff = startOfDay(today).getTime() - startOfDay(dueDate).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

const isToday = (date?: Date | null, today = new Date()) => {
  if (!date) return false;
  return startOfDay(date).getTime() === startOfDay(today).getTime();
};

const buildReminderMessage = (input: {
  clientName: string;
  label: string;
  amount: number;
  dueDate: Date;
  overdueDays: number;
}) => {
  const delay =
    input.overdueDays > 0
      ? `en retard depuis ${input.overdueDays} jour${input.overdueDays > 1 ? "s" : ""}`
      : "prévu aujourd’hui";

  return `Bonjour ${input.clientName}, rappel PayTranche: votre ${input.label} de ${formatAmount(input.amount)} est ${delay} (échéance ${formatDate(input.dueDate)}). Merci de régulariser dès que possible.`;
};

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

  async listWhatsAppReminders(tenantId: string) {
    const today = new Date();
    const dueUntil = endOfDay(today);

    await this.markDueItemsAsOverdue(tenantId, today);

    const [installments, credits] = await Promise.all([
      prisma.installment.findMany({
        where: {
          tenantId,
          remainingAmount: { gt: 0 },
          status: { notIn: [InstallmentStatus.PAYEE, InstallmentStatus.ANNULEE] },
          dueDate: { lte: dueUntil },
        },
        include: { client: true, credit: true },
        orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      }),
      prisma.credit.findMany({
        where: {
          tenantId,
          remainingAmount: { gt: 0 },
          status: { notIn: [CreditStatus.PAYE, CreditStatus.ANNULE] },
          dueDate: { lte: dueUntil },
          installments: { none: {} },
        },
        include: { client: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const installmentReminders = installments.map((installment) => {
      const overdueDays = daysLate(installment.dueDate, today);
      const amount = installment.remainingAmount;
      const label = `tranche ${installment.number}`;

      return {
        id: `installment-${installment.id}`,
        type: "installment" as const,
        sourceId: installment.id,
        creditId: installment.creditId,
        clientId: installment.clientId,
        clientName: installment.client.name,
        clientPhone: installment.client.phone,
        title: `Tranche ${installment.number}`,
        description: installment.credit.description,
        amount,
        dueDate: installment.dueDate,
        overdueDays,
        reminderCount: installment.reminderCount,
        lastReminderAt: installment.lastReminderAt,
        remindedToday: isToday(installment.lastReminderAt, today),
        whatsappMessage: buildReminderMessage({
          clientName: installment.client.name,
          label,
          amount,
          dueDate: installment.dueDate,
          overdueDays,
        }),
      };
    });

    const creditReminders = credits.map((credit) => {
      const dueDate = credit.dueDate as Date;
      const overdueDays = daysLate(dueDate, today);
      const amount = credit.remainingAmount;

      return {
        id: `credit-${credit.id}`,
        type: "credit" as const,
        sourceId: credit.id,
        creditId: credit.id,
        clientId: credit.clientId,
        clientName: credit.client.name,
        clientPhone: credit.client.phone,
        title: "Dette client",
        description: credit.description,
        amount,
        dueDate,
        overdueDays,
        reminderCount: credit.reminderCount,
        lastReminderAt: credit.lastReminderAt,
        remindedToday: isToday(credit.lastReminderAt, today),
        whatsappMessage: buildReminderMessage({
          clientName: credit.client.name,
          label: "paiement",
          amount,
          dueDate,
          overdueDays,
        }),
      };
    });

    return [...installmentReminders, ...creditReminders].sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() ||
        a.clientName.localeCompare(b.clientName)
    );
  }

  async markWhatsAppReminderPrepared(
    tenantId: string,
    type: "credit" | "installment",
    id: string
  ) {
    if (type === "installment") {
      const installment = await prisma.installment.findFirst({
        where: { id, tenantId },
      });

      if (!installment) {
        throw new AppError("Installment not found", 404);
      }

      return prisma.installment.update({
        where: { id: installment.id },
        data: {
          reminderCount: { increment: 1 },
          lastReminderAt: new Date(),
        },
      });
    }

    const credit = await prisma.credit.findFirst({
      where: { id, tenantId },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    return prisma.credit.update({
      where: { id: credit.id },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    });
  }

  private async markDueItemsAsOverdue(tenantId: string, today: Date) {
    await Promise.all([
      prisma.installment.updateMany({
        where: {
          tenantId,
          dueDate: { lt: startOfDay(today) },
          remainingAmount: { gt: 0 },
          status: InstallmentStatus.A_VENIR,
        },
        data: { status: InstallmentStatus.EN_RETARD },
      }),
      prisma.credit.updateMany({
        where: {
          tenantId,
          dueDate: { lt: startOfDay(today) },
          remainingAmount: { gt: 0 },
          status: CreditStatus.ACTIF,
          installments: { none: {} },
        },
        data: { status: CreditStatus.EN_RETARD },
      }),
    ]);
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
