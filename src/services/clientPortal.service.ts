import { CreditStatus, InstallmentStatus, PaymentStatus } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";
import { PaytechService } from "./paytech.service";

const MIN_PAYTECH_AMOUNT = 101;

export class ClientPortalService {
  private paytechService = new PaytechService();

  async getPortal(token: string) {
    const credit = await prisma.credit.findUnique({
      where: { clientPortalToken: token },
      include: {
        tenant: { select: { name: true } },
        client: { select: { name: true, phone: true } },
        installments: {
          orderBy: [{ dueDate: "asc" }, { number: "asc" }],
        },
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          orderBy: { paidAt: "desc" },
          select: {
            id: true,
            amount: true,
            method: true,
            reference: true,
            paidAt: true,
            installmentId: true,
          },
        },
      },
    });

    if (!credit) {
      throw new AppError("Lien de suivi introuvable", 404);
    }

    const nextInstallment = credit.installments.find(
      (installment) =>
        installment.remainingAmount > 0 &&
        installment.status !== InstallmentStatus.ANNULEE,
    );
    const nextPayment =
      credit.remainingAmount > 0
        ? {
            type: nextInstallment ? "installment" : "credit",
            installmentId: nextInstallment?.id || null,
            label: nextInstallment
              ? `Tranche ${nextInstallment.number}`
              : "Solde restant",
            amount: nextInstallment?.remainingAmount || credit.remainingAmount,
            dueDate: nextInstallment?.dueDate || credit.dueDate,
            canPayOnline:
              (nextInstallment?.remainingAmount || credit.remainingAmount) >=
              MIN_PAYTECH_AMOUNT,
          }
        : null;

    return {
      sellerName: credit.tenant.name,
      clientName: credit.client.name,
      clientPhone: credit.client.phone,
      credit: {
        id: credit.id,
        amount: credit.amount,
        paidAmount: credit.paidAmount,
        remainingAmount: credit.remainingAmount,
        description: credit.description,
        dueDate: credit.dueDate,
        status: credit.status,
        createdAt: credit.createdAt,
        isPaid:
          credit.remainingAmount <= 0 || credit.status === CreditStatus.PAYE,
      },
      installments: credit.installments.map((installment) => ({
        id: installment.id,
        number: installment.number,
        amount: installment.amount,
        paidAmount: installment.paidAmount,
        remainingAmount: installment.remainingAmount,
        dueDate: installment.dueDate,
        status: installment.status,
      })),
      payments: credit.payments,
      nextPayment,
    };
  }

  async createNextPayment(token: string, targetPayment: string) {
    const portal = await this.getPortal(token);

    if (!portal.nextPayment) {
      throw new AppError("Cette dette est déjà soldée", 400);
    }

    if (!portal.nextPayment.canPayOnline) {
      throw new AppError(
        `PayTech accepte seulement les paiements supérieurs à 100 FCFA. Montant actuel: ${portal.nextPayment.amount} FCFA.`,
        400,
      );
    }

    return this.paytechService.createPaymentRequest({
      tenantId: await this.getTenantIdByToken(token),
      creditId: portal.credit.id,
      installmentId: portal.nextPayment.installmentId || undefined,
      amount: portal.nextPayment.amount,
      targetPayment,
      clientPhone: portal.clientPhone || undefined,
      portalToken: token,
    });
  }

  private async getTenantIdByToken(token: string) {
    const credit = await prisma.credit.findUnique({
      where: { clientPortalToken: token },
      select: { tenantId: true },
    });

    if (!credit) {
      throw new AppError("Lien de suivi introuvable", 404);
    }

    return credit.tenantId;
  }
}
