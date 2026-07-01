import {
  CreditStatus,
  InstallmentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { CreateInstallmentPlanInput } from "../schemas/installment.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";
import { PaymentService } from "./payment.service";

const addFrequency = (date: Date, frequency: "DAILY" | "WEEKLY" | "MONTHLY", index: number) => {
  const dueDate = new Date(date);

  if (frequency === "DAILY") {
    dueDate.setDate(date.getDate() + index);
  } else if (frequency === "WEEKLY") {
    dueDate.setDate(date.getDate() + index * 7);
  } else {
    dueDate.setMonth(date.getMonth() + index);
  }

  return dueDate;
};

export class InstallmentService {
  private paymentService = new PaymentService();

  async createPlan(tenantId: string, creditId: string, input: CreateInstallmentPlanInput) {
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, tenantId },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    if (credit.remainingAmount <= 0) {
      throw new AppError("Credit is already paid", 400);
    }

    const existingCount = await prisma.installment.count({
      where: { tenantId, creditId },
    });

    if (existingCount > 0) {
      throw new AppError("This credit already has an installment plan", 400);
    }

    const baseAmount = Math.floor(credit.remainingAmount / input.count);
    const remainder = credit.remainingAmount % input.count;

    return prisma.$transaction(async (tx) => {
      const installments = [];

      for (let index = 0; index < input.count; index++) {
        const amount = baseAmount + (index === input.count - 1 ? remainder : 0);
        installments.push(
          await tx.installment.create({
            data: {
              tenantId,
              creditId,
              clientId: credit.clientId,
              number: index + 1,
              amount,
              remainingAmount: amount,
              dueDate: addFrequency(input.firstDueDate, input.frequency, index),
            },
          })
        );
      }

      return installments;
    });
  }

  async list(
    tenantId: string,
    filters: { creditId?: string; clientId?: string; status?: InstallmentStatus } = {}
  ) {
    const where: Prisma.InstallmentWhereInput = { tenantId };

    if (filters.creditId) where.creditId = filters.creditId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;

    return prisma.installment.findMany({
      where,
      include: { client: true, credit: true },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    });
  }

  async getById(tenantId: string, id: string) {
    const installment = await prisma.installment.findFirst({
      where: { id, tenantId },
      include: { client: true, credit: true },
    });

    if (!installment) {
      throw new AppError("Installment not found", 404);
    }

    return installment;
  }

  async pay(
    tenantId: string,
    id: string,
    input: {
      amount?: number;
      method?: PaymentMethod;
      reference?: string;
    } = {}
  ) {
    const installment = await this.getById(tenantId, id);

    if (installment.remainingAmount <= 0 || installment.status === InstallmentStatus.PAYEE) {
      throw new AppError("Installment is already paid", 400);
    }

    const paidAmount = input.amount ?? installment.remainingAmount;

    if (paidAmount > installment.remainingAmount) {
      throw new AppError("Payment amount exceeds installment balance", 400);
    }

    return this.paymentService.create(tenantId, {
      clientId: installment.clientId,
      creditId: installment.creditId,
      installmentId: installment.id,
      amount: paidAmount,
      method: input.method,
      status: PaymentStatus.COMPLETED,
      reference: input.reference || `Tranche ${installment.number}`,
    });
  }

  async payMultiple(
    tenantId: string,
    creditId: string,
    input: {
      installmentIds: string[];
      method?: PaymentMethod;
      reference?: string;
    }
  ) {
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, tenantId },
      include: {
        client: true,
        installments: {
          where: {
            remainingAmount: { gt: 0 },
            status: { not: InstallmentStatus.ANNULEE },
          },
          orderBy: [{ dueDate: "asc" }, { number: "asc" }],
        },
      },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    if (credit.installments.length === 0) {
      throw new AppError("This credit has no unpaid installments", 400);
    }

    const selectedIds = new Set(input.installmentIds);
    const selectedInstallments = credit.installments.filter((installment) =>
      selectedIds.has(installment.id)
    );

    if (selectedInstallments.length !== selectedIds.size) {
      throw new AppError("One or more selected installments are invalid", 400);
    }

    const totalAmount = selectedInstallments.reduce(
      (total, installment) => total + installment.remainingAmount,
      0
    );

    return prisma.$transaction(async (tx) => {
      const payments = [];

      for (const installment of selectedInstallments) {
        const payment = await tx.payment.create({
          data: {
            tenantId,
            clientId: credit.clientId,
            creditId: credit.id,
            installmentId: installment.id,
            amount: installment.remainingAmount,
            method: input.method ?? PaymentMethod.CASH,
            status: PaymentStatus.COMPLETED,
            reference: input.reference
              ? `${input.reference} - Tranche ${installment.number}`
              : `Paiement sélectionné - Tranche ${installment.number}`,
          },
        });

        await tx.installment.update({
          where: { id: installment.id },
          data: {
            paidAmount: installment.amount,
            remainingAmount: 0,
            status: InstallmentStatus.PAYEE,
          },
        });

        payments.push(payment);
      }

      const creditRemainingAmount = Math.max(credit.remainingAmount - totalAmount, 0);
      await tx.credit.update({
        where: { id: credit.id },
        data: {
          paidAmount: credit.paidAmount + totalAmount,
          remainingAmount: creditRemainingAmount,
          status:
            creditRemainingAmount <= 0
              ? CreditStatus.PAYE
              : CreditStatus.ACTIF,
        },
      });

      await tx.client.update({
        where: { id: credit.clientId },
        data: {
          totalDebt: Math.max(credit.client.totalDebt - totalAmount, 0),
        },
      });

      return {
        amount: totalAmount,
        payments,
        paidInstallmentsCount: selectedInstallments.length,
      };
    });
  }

  async markOverdue(tenantId: string) {
    const now = new Date();
    await prisma.installment.updateMany({
      where: {
        tenantId,
        status: InstallmentStatus.A_VENIR,
        remainingAmount: { gt: 0 },
        dueDate: { lt: now },
      },
      data: { status: InstallmentStatus.EN_RETARD },
    });

    return this.list(tenantId, { status: InstallmentStatus.EN_RETARD });
  }
}
