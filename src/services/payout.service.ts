import {
  PaymentMethod,
  PayoutOperator,
  PayoutStatus,
  Prisma,
  WalletTransactionType,
} from "@prisma/client";
import { UpsertPayoutProfileInput } from "../schemas/payout.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";

const PAYTECH_BASE_URL = "https://paytech.sn/api";

const getCommissionRate = () => {
  const raw = Number(process.env.PAYTRANCHE_COMMISSION_RATE ?? 0);
  if (Number.isNaN(raw) || raw < 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const calculateFee = (amount: number) => {
  return Math.round(amount * getCommissionRate());
};

const getPublicUrl = () =>
  (process.env.PUBLIC_API_URL || process.env.APP_URL || "").replace(/\/$/, "");

const isAutomaticPayoutEnabled = () => {
  if (process.env.PAYTECH_AUTO_PAYOUTS_ENABLED !== "true") return false;
  return (process.env.PAYTECH_ENV || "test") === "prod";
};

const normalizePhoneForPaytechTransfer = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("221") && digits.length > 9) return digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits.slice(1);
  return digits;
};

const payoutOperatorToPaytechService = (operator: PayoutOperator) => {
  if (operator === PayoutOperator.WAVE) return "Wave Senegal";
  if (operator === PayoutOperator.ORANGE_MONEY) return "Orange Money Senegal";
  if (operator === PayoutOperator.FREE_MONEY) return "Free Money Senegal";
  throw new AppError("Unsupported payout operator", 400);
};

const paymentMethodToPayoutOperator = (
  method?: PaymentMethod | null,
): PayoutOperator | null => {
  if (method === PaymentMethod.WAVE) return PayoutOperator.WAVE;
  if (method === PaymentMethod.ORANGE_MONEY) return PayoutOperator.ORANGE_MONEY;
  if (method === PaymentMethod.FREE_MONEY) return PayoutOperator.FREE_MONEY;
  return null;
};

type PaytechTransferPayload = {
  amount: number;
  destination_number: string;
  service: string;
  callback_url: string;
  external_id: string;
};

type PaytechTransferResponse = {
  success?: number | boolean;
  message?: string;
  transfer?: {
    token_transfer?: string | null;
    id_transfer?: string | null;
    state?: string | null;
    failed_at?: string | null;
    rejected_at?: string | null;
    validate_at?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type PayoutTransferRecord = {
  id: string;
  tenantId: string;
  providerTransferId?: string | null;
  providerTransferToken?: string | null;
  providerTransferState?: string | null;
};

const asPayoutTransferRecord = <T extends { id: string; tenantId: string }>(
  payout: T,
) => payout as T & PayoutTransferRecord;

const normalizeTransferState = (state?: string | null) => {
  const normalized = (state || "").toLowerCase();
  if (
    [
      "success",
      "successful",
      "sent",
      "validated",
      "complete",
      "completed",
    ].includes(normalized)
  ) {
    return PayoutStatus.SENT;
  }
  if (
    ["failed", "rejected", "cancelled", "canceled", "error"].includes(
      normalized,
    )
  ) {
    return PayoutStatus.FAILED;
  }
  return PayoutStatus.PROCESSING;
};

const extractTransferFromPayload = (payload: Record<string, unknown>) => {
  const transfer =
    payload.transfer && typeof payload.transfer === "object"
      ? (payload.transfer as Record<string, unknown>)
      : payload;

  return {
    externalId: String(transfer.external_id || payload.external_id || ""),
    providerTransferId: String(
      transfer.id_transfer || payload.id_transfer || "",
    ),
    state: String(transfer.state || payload.state || ""),
  };
};

export class PayoutService {
  async getProfile(tenantId: string) {
    return prisma.sellerPayoutProfile.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: "desc" }, { operator: "asc" }],
    });
  }

  async upsertProfile(tenantId: string, input: UpsertPayoutProfileInput) {
    await prisma.sellerWallet.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    const existingProfilesCount = await prisma.sellerPayoutProfile.count({
      where: { tenantId },
    });
    const shouldBeDefault =
      Boolean(input.isDefault) || existingProfilesCount === 0;

    return prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.sellerPayoutProfile.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      return tx.sellerPayoutProfile.upsert({
        where: {
          tenantId_operator: {
            tenantId,
            operator: input.operator,
          },
        },
        create: {
          tenantId,
          operator: input.operator,
          phone: input.phone,
          holderName: input.holderName,
          isDefault: shouldBeDefault,
        },
        update: {
          phone: input.phone,
          holderName: input.holderName,
          isDefault: shouldBeDefault ? true : undefined,
          isVerified: false,
        },
      });
    });
  }

  async getWallet(tenantId: string) {
    const wallet = await prisma.sellerWallet.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    const recentTransactions = await prisma.walletTransaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { client: true, payout: true },
    });

    return { ...wallet, recentTransactions };
  }

  async listPayouts(tenantId: string, filters: { status?: PayoutStatus } = {}) {
    const where: Prisma.SellerPayoutWhereInput = { tenantId };
    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.sellerPayout.findMany({
      where,
      include: { client: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAutomaticPayoutForPayment(input: {
    tenantId: string;
    clientId: string;
    paymentId: string;
    externalPaymentId: string;
    amount: number;
    paymentMethod?: PaymentMethod | null;
  }) {
    const existing = await prisma.sellerPayout.findFirst({
      where: {
        tenantId: input.tenantId,
        externalPaymentId: input.externalPaymentId,
      },
    });

    if (existing) {
      return existing;
    }

    const preferredOperator = paymentMethodToPayoutOperator(
      input.paymentMethod,
    );
    const profiles = await prisma.sellerPayoutProfile.findMany({
      where: { tenantId: input.tenantId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    const profile =
      profiles.find((item) => item.operator === preferredOperator) ||
      profiles.find((item) => item.isDefault) ||
      profiles[0];

    const feeAmount = calculateFee(input.amount);
    const netAmount = Math.max(input.amount - feeAmount, 0);

    const result = await prisma.$transaction(async (tx) => {
      await tx.sellerWallet.upsert({
        where: { tenantId: input.tenantId },
        create: {
          tenantId: input.tenantId,
          pendingAmount: netAmount,
          totalCollected: input.amount,
          totalFees: feeAmount,
        },
        update: {
          pendingAmount: { increment: netAmount },
          totalCollected: { increment: input.amount },
          totalFees: { increment: feeAmount },
        },
      });

      const collection = await tx.walletTransaction.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          paymentId: input.paymentId,
          externalPaymentId: input.externalPaymentId,
          type: WalletTransactionType.COLLECTION,
          amount: input.amount,
          feeAmount,
          netAmount,
          description: "Paiement client recu via PayTech",
        },
      });

      if (!profile) {
        return collection;
      }

      const payout = await tx.sellerPayout.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          paymentId: input.paymentId,
          externalPaymentId: input.externalPaymentId,
          amount: input.amount,
          feeAmount,
          netAmount,
          operator: profile.operator,
          phone: profile.phone,
          holderName: profile.holderName,
          status: PayoutStatus.PENDING,
        },
      });

      await tx.walletTransaction.update({
        where: { id: collection.id },
        data: { payoutId: payout.id },
      });

      return payout;
    });

    if (
      isAutomaticPayoutEnabled() &&
      "status" in result &&
      "operator" in result
    ) {
      return this.initiatePayoutTransfer(input.tenantId, result.id).catch(
        async (error) => {
          await prisma.sellerPayout.update({
            where: { id: result.id },
            data: {
              status: PayoutStatus.FAILED,
              failureReason:
                error instanceof Error
                  ? error.message
                  : "Automatic payout transfer failed",
            },
          });

          return prisma.sellerPayout.findUnique({ where: { id: result.id } });
        },
      );
    }

    return result;
  }

  async markPayoutSent(tenantId: string, payoutId: string) {
    const payout = await prisma.sellerPayout.findFirst({
      where: { id: payoutId, tenantId },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    if (payout.status === PayoutStatus.SENT) {
      return payout;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.sellerPayout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.SENT, processedAt: new Date() },
      });

      await tx.sellerWallet.update({
        where: { tenantId },
        data: {
          pendingAmount: { decrement: payout.netAmount },
          paidOutAmount: { increment: payout.netAmount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          tenantId,
          clientId: payout.clientId,
          paymentId: payout.paymentId,
          externalPaymentId: payout.externalPaymentId,
          payoutId: payout.id,
          type: WalletTransactionType.PAYOUT,
          amount: payout.amount,
          feeAmount: payout.feeAmount,
          netAmount: payout.netAmount,
          description: "Reversement envoye au vendeur",
        },
      });

      return updated;
    });
  }

  async updatePayoutDestination(
    tenantId: string,
    payoutId: string,
    input: {
      operator: PayoutOperator;
      phone: string;
      holderName: string;
    },
  ) {
    const payout = await prisma.sellerPayout.findFirst({
      where: { id: payoutId, tenantId },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    if (payout.status === PayoutStatus.SENT) {
      throw new AppError("A sent payout cannot be modified", 409);
    }

    if (payout.status === PayoutStatus.PROCESSING) {
      throw new AppError("Sync the processing payout before editing it", 409);
    }

    return prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        operator: input.operator,
        phone: input.phone,
        holderName: input.holderName,
        status: PayoutStatus.PENDING,
        failureReason: null,
        providerTransferId: null,
        providerTransferToken: null,
        providerTransferState: null,
      },
    });
  }

  async markPayoutPaidManually(
    tenantId: string,
    payoutId: string,
    input: {
      reference: string;
      note?: string;
    },
    adminEmail?: string,
  ) {
    const payout = await prisma.sellerPayout.findFirst({
      where: { id: payoutId, tenantId },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    if (payout.status === PayoutStatus.SENT) {
      return payout;
    }

    if (payout.status === PayoutStatus.PROCESSING) {
      throw new AppError("Sync the processing payout before marking it paid", 409);
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.sellerPayout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.SENT,
          processedAt: now,
          failureReason: null,
          manualReference: input.reference,
          manualNote: input.note || null,
          manuallyMarkedAt: now,
          manuallyMarkedBy: adminEmail || null,
        },
      });

      await tx.sellerWallet.update({
        where: { tenantId },
        data: {
          pendingAmount: { decrement: payout.netAmount },
          paidOutAmount: { increment: payout.netAmount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          tenantId,
          clientId: payout.clientId,
          paymentId: payout.paymentId,
          externalPaymentId: payout.externalPaymentId,
          payoutId: payout.id,
          type: WalletTransactionType.PAYOUT,
          amount: payout.amount,
          feeAmount: payout.feeAmount,
          netAmount: payout.netAmount,
          description: `Reversement marque paye manuellement (${input.reference})`,
        },
      });

      return updated;
    });
  }

  async initiatePayoutTransfer(tenantId: string, payoutId: string) {
    if (!isAutomaticPayoutEnabled()) {
      throw new AppError("Automatic PayTech payouts are not enabled", 403);
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;
    const publicUrl = getPublicUrl();

    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    if (!publicUrl) {
      throw new AppError(
        "PUBLIC_API_URL must be configured for PayTech payout callbacks",
        503,
      );
    }

    const payout = await prisma.sellerPayout.findFirst({
      where: { id: payoutId, tenantId },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    if (payout.status === PayoutStatus.SENT) {
      return payout;
    }

    const trackedPayout = asPayoutTransferRecord(payout);

    if (payout.status === PayoutStatus.PROCESSING) {
      if (trackedPayout.providerTransferId) {
        return this.syncPayoutTransferStatus(tenantId, payout.id);
      }

      throw new AppError("Payout transfer is already processing", 409);
    }

    if (trackedPayout.providerTransferId && payout.status !== PayoutStatus.FAILED) {
      return this.syncPayoutTransferStatus(tenantId, payout.id);
    }

    const requestBody: PaytechTransferPayload = {
      amount: payout.netAmount,
      destination_number: normalizePhoneForPaytechTransfer(payout.phone),
      service: payoutOperatorToPaytechService(payout.operator),
      callback_url: `${publicUrl}/api/paytech/transfer-callback`,
      external_id: payout.id,
    };

    await prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PROCESSING,
        attemptedAt: new Date(),
        failureReason: null,
        rawTransferRequest: requestBody,
      },
    });

    const response = await fetch(`${PAYTECH_BASE_URL}/transfer/transferFund`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: JSON.stringify(requestBody),
    });

    const paytechResponse = (await response
      .json()
      .catch(() => null)) as PaytechTransferResponse | null;

    if (!response.ok || !paytechResponse || paytechResponse.success !== 1) {
      return prisma.sellerPayout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason:
            paytechResponse?.message ||
            "Unable to initiate PayTech payout transfer",
          rawTransferResponse:
            (paytechResponse as Prisma.InputJsonObject | null) ?? {
              status: response.status,
            },
        },
      });
    }

    const transfer = paytechResponse.transfer;
    const updated = await prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        status: normalizeTransferState(transfer?.state),
        providerTransferId: transfer?.id_transfer || null,
        providerTransferToken: transfer?.token_transfer || null,
        providerTransferState: transfer?.state || null,
        rawTransferResponse: paytechResponse as Prisma.InputJsonObject,
      },
    });

    if (updated.status === PayoutStatus.SENT) {
      return this.markPayoutSent(tenantId, updated.id);
    }

    return updated;
  }

  async syncPayoutTransferStatus(tenantId: string, payoutId: string) {
    const payout = await prisma.sellerPayout.findFirst({
      where: { id: payoutId, tenantId },
    });

    if (!payout) {
      throw new AppError("Payout not found", 404);
    }

    const trackedPayout = asPayoutTransferRecord(payout);

    if (!trackedPayout.providerTransferId) {
      return payout;
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    const url = new URL(`${PAYTECH_BASE_URL}/transfer/get-status`);
    url.searchParams.set("id_transfer", trackedPayout.providerTransferId);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
    });

    const paytechResponse = (await response
      .json()
      .catch(() => null)) as PaytechTransferResponse | null;

    if (!response.ok || !paytechResponse || paytechResponse.success !== 1) {
      return prisma.sellerPayout.update({
        where: { id: payout.id },
        data: {
          failureReason:
            paytechResponse?.message ||
            "Unable to refresh PayTech payout status",
          rawTransferResponse:
            (paytechResponse as Prisma.InputJsonObject | null) ?? {
              status: response.status,
            },
        },
      });
    }

    return this.applyTransferState(trackedPayout, paytechResponse);
  }

  async handleTransferCallback(payload: Record<string, unknown>) {
    const { externalId, providerTransferId } =
      extractTransferFromPayload(payload);

    const payout =
      (externalId
        ? await prisma.sellerPayout.findUnique({ where: { id: externalId } })
        : null) ||
      (providerTransferId
        ? await prisma.sellerPayout.findUnique({
            where: { providerTransferId },
          })
        : null);

    if (!payout) {
      throw new AppError("Payout transfer not found", 404);
    }

    const trackedPayout = asPayoutTransferRecord(payout);

    await prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        providerTransferId:
          trackedPayout.providerTransferId || providerTransferId || null,
        rawTransferCallback: payload as Prisma.InputJsonObject,
      },
    });

    return this.syncPayoutTransferStatus(payout.tenantId, payout.id);
  }

  private async applyTransferState(
    payout: PayoutTransferRecord,
    response: PaytechTransferResponse,
  ) {
    const transfer = response.transfer;
    const status = normalizeTransferState(transfer?.state);

    if (status === PayoutStatus.SENT) {
      return this.markPayoutSent(payout.tenantId, payout.id);
    }

    return prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        status,
        providerTransferId: transfer?.id_transfer || payout.providerTransferId,
        providerTransferToken:
          transfer?.token_transfer || payout.providerTransferToken,
        providerTransferState: transfer?.state || payout.providerTransferState,
        failureReason:
          status === PayoutStatus.FAILED
            ? response.message || "PayTech payout transfer failed"
            : null,
        rawTransferResponse: response as Prisma.InputJsonObject,
      },
    });
  }
}
