import { CreditStatus, InstallmentStatus, PaymentStatus, Prisma } from "@prisma/client";
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

  async pay(tenantId: string, id: string, amount?: number) {
    const installment = await this.getById(tenantId, id);

    if (installment.remainingAmount <= 0 || installment.status === InstallmentStatus.PAYEE) {
      throw new AppError("Installment is already paid", 400);
    }

    const paidAmount = amount ?? installment.remainingAmount;

    if (paidAmount > installment.remainingAmount) {
      throw new AppError("Payment amount exceeds installment balance", 400);
    }

    return this.paymentService.create(tenantId, {
      clientId: installment.clientId,
      creditId: installment.creditId,
      installmentId: installment.id,
      amount: paidAmount,
      status: PaymentStatus.COMPLETED,
      reference: `Tranche ${installment.number}`,
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
