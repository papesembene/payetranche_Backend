import { CreditStatus, InstallmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { paymentModel } from "../models/payment.model";
import { CreatePaymentInput } from "../schemas/payment.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";

export class PaymentService {
  async create(tenantId: string, input: CreatePaymentInput) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, tenantId },
    });

    if (!client) {
      throw new AppError("Client not found", 404);
    }

    if (!input.creditId) {
      return paymentModel.create({
        ...input,
        tenantId,
        status: input.status ?? PaymentStatus.COMPLETED,
      });
    }

    if (input.installmentId) {
      const installment = await prisma.installment.findFirst({
        where: {
          id: input.installmentId,
          tenantId,
          creditId: input.creditId,
          clientId: input.clientId,
        },
      });

      if (!installment) {
        throw new AppError("Installment not found for this credit", 404);
      }

      if (input.amount > installment.remainingAmount) {
        throw new AppError("Payment amount exceeds remaining installment balance", 400);
      }
    }

    const credit = await prisma.credit.findFirst({
      where: { id: input.creditId, tenantId, clientId: input.clientId },
    });

    if (!credit) {
      throw new AppError("Credit not found for this client", 404);
    }

    if (input.amount > credit.remainingAmount) {
      throw new AppError("Payment amount exceeds remaining credit balance", 400);
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          ...input,
          tenantId,
          status: input.status ?? PaymentStatus.COMPLETED,
        },
        include: { client: true, credit: true },
      });

      if (payment.status === PaymentStatus.COMPLETED) {
        const paidAmount = credit.paidAmount + payment.amount;
        const remainingAmount = Math.max(credit.amount - paidAmount, 0);
        const status =
          remainingAmount <= 0 ? CreditStatus.PAYE : CreditStatus.ACTIF;

        await tx.credit.update({
          where: { id: credit.id },
          data: { paidAmount, remainingAmount, status },
        });

        await tx.client.update({
          where: { id: client.id },
          data: {
            totalDebt: Math.max(client.totalDebt - payment.amount, 0),
          },
        });

        if (input.installmentId) {
          const installment = await tx.installment.findUniqueOrThrow({
            where: { id: input.installmentId },
          });
          const installmentPaidAmount = installment.paidAmount + payment.amount;
          const installmentRemainingAmount = Math.max(
            installment.amount - installmentPaidAmount,
            0
          );

          await tx.installment.update({
            where: { id: installment.id },
            data: {
              paidAmount: installmentPaidAmount,
              remainingAmount: installmentRemainingAmount,
              status:
                installmentRemainingAmount <= 0
                  ? InstallmentStatus.PAYEE
                  : installment.status,
            },
          });
        }
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { client: true, credit: true },
      });
    });
  }

  async list(
    tenantId: string,
    filters: {
      clientId?: string;
      creditId?: string;
      status?: PaymentStatus;
    } = {}
  ) {
    const where: Prisma.PaymentWhereInput = { tenantId };

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.creditId) {
      where.creditId = filters.creditId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return paymentModel.findMany(where);
  }

  async getById(tenantId: string, id: string) {
    const payment = await paymentModel.findById(tenantId, id);

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return payment;
  }
}
