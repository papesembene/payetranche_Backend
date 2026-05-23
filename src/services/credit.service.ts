import crypto from "crypto";
import { CreditStatus, Prisma } from "@prisma/client";
import { clientModel } from "../models/client.model";
import { creditModel } from "../models/credit.model";
import { CreateCreditInput, UpdateCreditInput } from "../schemas/credit.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const generateClientPortalToken = () =>
  crypto.randomBytes(24).toString("base64url");

export class CreditService {
  async create(tenantId: string, input: CreateCreditInput) {
    const client = await clientModel.findById(tenantId, input.clientId);

    if (!client) {
      throw new AppError("Client not found", 404);
    }

    if (input.paidAmount > input.amount) {
      throw new AppError("Paid amount cannot exceed credit amount", 400);
    }

    const remainingAmount = input.amount - input.paidAmount;
    const status = this.resolveStatus(remainingAmount, input.dueDate);

    return prisma.$transaction(async (tx) => {
      const credit = await tx.credit.create({
        data: {
          ...input,
          tenantId,
          remainingAmount,
          status,
          clientPortalToken: generateClientPortalToken(),
        },
        include: { client: true },
      });

      await tx.client.update({
        where: { id: input.clientId },
        data: { totalDebt: { increment: remainingAmount } },
      });

      return credit;
    });
  }

  async list(
    tenantId: string,
    filters: {
      clientId?: string;
      status?: CreditStatus;
      includePaid?: string;
    } = {}
  ) {
    const where: Prisma.CreditWhereInput = { tenantId };

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.includePaid !== "true" && !filters.status) {
      where.status = { not: CreditStatus.PAYE };
    }

    return creditModel.findMany(where);
  }

  async history(tenantId: string, clientId?: string) {
    return creditModel.findMany({
      tenantId,
      ...(clientId ? { clientId } : {}),
    });
  }

  async getPayments(tenantId: string, id: string) {
    const credit = await this.getById(tenantId, id);
    return credit.payments;
  }

  async timeline(tenantId: string, id: string) {
    const credit = await prisma.credit.findFirst({
      where: { id, tenantId },
      include: { client: true },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    const [payments, externalPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { tenantId, creditId: id },
        include: {
          installment: {
            select: {
              number: true,
              status: true,
            },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.externalPayment.findMany({
        where: { tenantId, creditId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const events: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      amount: number;
      status: string;
      occurredAt: Date;
    }> = [
      {
        id: `credit-${credit.id}`,
        type: "CREDIT_CREATED",
        title: "Vente créée",
        description: credit.description || `Vente à crédit pour ${credit.client.name}`,
        amount: credit.amount,
        status: credit.status,
        occurredAt: credit.createdAt,
      },
    ];

    externalPayments.forEach((payment) => {
      events.push({
        id: `paytech-${payment.id}`,
        type: "PAYTECH_LINK_CREATED",
        title: "Lien PayTech généré",
        description: payment.refCommand,
        amount: payment.amount,
        status: payment.status,
        occurredAt: payment.createdAt,
      });
    });

    payments.forEach((payment) => {
      const installmentNumber = payment.installment?.number;
      const installmentIsPaid = payment.installment?.status === "PAYEE";
      const title = installmentNumber
        ? installmentIsPaid
          ? `Tranche ${installmentNumber} payée`
          : `Paiement tranche ${installmentNumber} reçu`
        : "Paiement reçu";

      events.push({
        id: `payment-${payment.id}`,
        type: installmentNumber && installmentIsPaid ? "INSTALLMENT_PAID" : "PAYMENT_RECEIVED",
        title,
        description: payment.reference || `Paiement ${payment.method}`,
        amount: payment.amount,
        status: payment.status,
        occurredAt: payment.paidAt || payment.createdAt,
      });
    });

    return events.sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
  }

  async getClientPortalLink(tenantId: string, id: string) {
    const credit = await prisma.credit.findFirst({
      where: { id, tenantId },
      select: { id: true, clientPortalToken: true },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    const token = credit.clientPortalToken || generateClientPortalToken();
    const updated = credit.clientPortalToken
      ? credit
      : await prisma.credit.update({
          where: { id: credit.id },
          data: { clientPortalToken: token },
          select: { id: true, clientPortalToken: true },
        });

    return {
      token: updated.clientPortalToken,
      url: `${getFrontendUrl()}/suivi/${updated.clientPortalToken}`,
    };
  }

  async getById(tenantId: string, id: string) {
    const credit = await creditModel.findById(tenantId, id);

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    return credit;
  }

  async update(tenantId: string, id: string, input: UpdateCreditInput) {
    const current = await this.getById(tenantId, id);
    const hasActivity = await this.hasPaymentActivity(tenantId, id);

    if (hasActivity) {
      throw new AppError(
        "Cette vente a déjà un paiement. Elle ne peut plus être modifiée.",
        409
      );
    }

    const amount = input.amount ?? current.amount;
    const paidAmount = input.paidAmount ?? current.paidAmount;

    if (paidAmount > amount) {
      throw new AppError("Paid amount cannot exceed credit amount", 400);
    }

    const remainingAmount = amount - paidAmount;
    const status =
      input.status ?? this.resolveStatus(remainingAmount, input.dueDate ?? current.dueDate);

    const updatedCredit = await prisma.$transaction(async (tx) => {
      const updated = await tx.credit.update({
        where: { id },
        data: {
          ...input,
          remainingAmount,
          status,
        },
        include: { client: true, payments: true },
      });

      await tx.client.update({
        where: { id: current.clientId },
        data: {
          totalDebt: { increment: remainingAmount - current.remainingAmount },
        },
      });

      return updated;
    });

    return updatedCredit;
  }

  async delete(tenantId: string, id: string) {
    const credit = await this.getById(tenantId, id);
    const hasActivity = await this.hasPaymentActivity(tenantId, id);

    if (hasActivity) {
      throw new AppError(
        "Cette vente a déjà un paiement. Elle ne peut plus être supprimée.",
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.credit.delete({ where: { id } });
      await tx.client.update({
        where: { id: credit.clientId },
        data: {
          totalDebt: { decrement: credit.remainingAmount },
        },
      });
    });

    return { deleted: true };
  }

  private async hasPaymentActivity(tenantId: string, creditId: string) {
    const [paymentsCount, paidInstallmentsCount, completedExternalPaymentsCount] =
      await Promise.all([
        prisma.payment.count({
          where: { tenantId, creditId },
        }),
        prisma.installment.count({
          where: {
            tenantId,
            creditId,
            OR: [{ paidAmount: { gt: 0 } }, { remainingAmount: 0 }],
          },
        }),
        prisma.externalPayment.count({
          where: {
            tenantId,
            creditId,
            status: "COMPLETED",
          },
        }),
      ]);

    return (
      paymentsCount > 0 ||
      paidInstallmentsCount > 0 ||
      completedExternalPaymentsCount > 0
    );
  }

  private resolveStatus(remainingAmount: number, dueDate?: Date | null) {
    if (remainingAmount <= 0) {
      return CreditStatus.PAYE;
    }

    if (dueDate && dueDate < new Date()) {
      return CreditStatus.EN_RETARD;
    }

    return CreditStatus.ACTIF;
  }
}
