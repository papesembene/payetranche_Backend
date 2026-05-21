import crypto from "crypto";
import {
  ExternalPayment,
  ExternalPaymentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";
import { PaymentService } from "./payment.service";
import { PayoutService } from "./payout.service";

type PaytechRequestInput = {
  tenantId: string;
  userId?: string;
  creditId: string;
  installmentId?: string;
  amount?: number;
  targetPayment: string;
  clientPhone?: string;
  portalToken?: string;
};

type PaytechWebhookPayload = {
  type_event?: string;
  ref_command?: string;
  item_price?: string | number;
  final_item_price?: string | number;
  token?: string;
  payment_method?: string;
  client_phone?: string;
  api_key_sha256?: string;
  api_secret_sha256?: string;
  hmac_compute?: string;
  [key: string]: unknown;
};

const PAYTECH_BASE_URL = "https://paytech.sn/api";
const MIN_PAYTECH_AMOUNT = 101;
const SIMULATED_PAYMENT_METHOD = "Wave";
const isClientPaymentEnabled = () =>
  process.env.PAYTECH_CLIENT_PAYMENTS_ENABLED === "true";

const getPublicUrl = () => (process.env.PUBLIC_API_URL || process.env.APP_URL || "").replace(/\/$/, "");

const appendAutofill = (
  redirectUrl: string,
  targetPayment: string,
  clientPhone?: string | null,
  clientName?: string
) => {
  if (!clientPhone || targetPayment.includes(",")) {
    return redirectUrl;
  }

  const phone = clientPhone.startsWith("+")
    ? clientPhone
    : clientPhone.startsWith("221")
      ? `+${clientPhone}`
      : `+221${clientPhone}`;

  const params = new URLSearchParams({
    pn: phone,
    nn: phone.replace(/^\+221/, ""),
    fn: clientName || "",
    tp: targetPayment,
    nac: targetPayment === "Carte Bancaire" ? "0" : "1",
  });

  return `${redirectUrl}?${params.toString()}`;
};

const mapPaytechMethod = (method?: string | null) => {
  if (!method) return PaymentMethod.OTHER;
  if (method.toLowerCase().includes("orange")) return PaymentMethod.ORANGE_MONEY;
  if (method.toLowerCase().includes("wave")) return PaymentMethod.WAVE;
  if (method.toLowerCase().includes("free")) return PaymentMethod.FREE_MONEY;
  return PaymentMethod.OTHER;
};

export class PaytechService {
  private paymentService = new PaymentService();
  private payoutService = new PayoutService();

  async createPaymentRequest(input: PaytechRequestInput) {
    if (!isClientPaymentEnabled()) {
      throw new AppError(
        "Paiement PayTech désactivé. Le client doit payer directement le vendeur.",
        403,
      );
    }

    const credit = await prisma.credit.findFirst({
      where: {
        id: input.creditId,
        tenantId: input.tenantId,
      },
      include: { client: true },
    });

    if (!credit) {
      throw new AppError("Credit not found", 404);
    }

    if (credit.remainingAmount <= 0) {
      throw new AppError("Credit is already paid", 400);
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    let installment:
      | {
          id: string;
          number: number;
          remainingAmount: number;
          clientId: string;
          creditId: string;
        }
      | null = null;

    if (input.installmentId) {
      installment = await prisma.installment.findFirst({
        where: {
          id: input.installmentId,
          tenantId: input.tenantId,
          creditId: credit.id,
        },
      });

      if (!installment) {
        throw new AppError("Installment not found for this credit", 404);
      }
    }

    const amount = input.amount ?? installment?.remainingAmount ?? credit.remainingAmount;
    if (amount > credit.remainingAmount) {
      throw new AppError("Payment amount exceeds remaining credit balance", 400);
    }
    if (amount < MIN_PAYTECH_AMOUNT) {
      throw new AppError(
        `PayTech accepte seulement les paiements supérieurs à 100 FCFA. Montant actuel: ${amount} FCFA.`,
        400
      );
    }

    const refCommand = `PT-${Date.now()}-${credit.id.slice(-8)}`;
    const publicUrl = getPublicUrl();

    if (!publicUrl) {
      throw new AppError("PUBLIC_API_URL must be configured for PayTech redirects", 503);
    }

    const successUrl = new URL(`${publicUrl}/api/paytech/redirect/success`);
    successUrl.searchParams.set("provider", "paytech");
    successUrl.searchParams.set("ref", refCommand);

    const cancelUrl = new URL(`${publicUrl}/api/paytech/redirect/cancel`);
    cancelUrl.searchParams.set("provider", "paytech");
    cancelUrl.searchParams.set("ref", refCommand);

    if (input.portalToken) {
      successUrl.searchParams.set("portal", input.portalToken);
      cancelUrl.searchParams.set("portal", input.portalToken);
    }

    const requestBody = {
      item_name: installment
        ? `Paiement tranche ${installment.number} - ${credit.client.name}`
        : `Paiement dette ${credit.client.name}`,
      item_price: amount,
      currency: "XOF",
      ref_command: refCommand,
      command_name: `Paiement PayTranche - ${credit.client.name}`,
      env: process.env.PAYTECH_ENV || "test",
      target_payment: input.targetPayment,
      ipn_url: `${publicUrl}/api/paytech/ipn`,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      custom_field: JSON.stringify({
        tenantId: input.tenantId,
        clientId: credit.clientId,
        creditId: credit.id,
        installmentId: installment?.id,
        requestedById: input.userId,
        portalToken: input.portalToken,
      }),
    };

    const externalPayment = await prisma.externalPayment.create({
      data: {
        tenantId: input.tenantId,
        clientId: credit.clientId,
        creditId: credit.id,
        installmentId: installment?.id,
        requestedById: input.userId,
        amount,
        refCommand,
        targetPayment: input.targetPayment,
        clientPhone: input.clientPhone || credit.client.phone,
        rawRequest: requestBody,
      },
    });

    const response = await fetch(`${PAYTECH_BASE_URL}/payment/request-payment`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: JSON.stringify(requestBody),
    });

    const paytechResponse = (await response.json().catch(() => null)) as {
      success?: number;
      token?: string;
      redirect_url?: string;
      redirectUrl?: string;
      message?: string;
      error?: string[];
    } | null;

    if (!response.ok || paytechResponse?.success !== 1) {
      await prisma.externalPayment.update({
        where: { id: externalPayment.id },
        data: {
          status: ExternalPaymentStatus.FAILED,
          rawResponse: paytechResponse ?? { status: response.status },
        },
      });

      const details = Array.isArray(paytechResponse?.error)
        ? paytechResponse.error.join(" ")
        : "";

      throw new AppError(
        details || paytechResponse?.message || "Unable to create PayTech payment",
        502
      );
    }

    const redirectUrl = appendAutofill(
      paytechResponse.redirect_url || paytechResponse.redirectUrl || "",
      input.targetPayment,
      input.clientPhone || credit.client.phone,
      credit.client.name
    );

    const updated = await prisma.externalPayment.update({
      where: { id: externalPayment.id },
      data: {
        status: ExternalPaymentStatus.PENDING,
        providerToken: paytechResponse.token,
        redirectUrl,
        rawResponse: paytechResponse,
      },
    });

    return {
      id: updated.id,
      refCommand: updated.refCommand,
      status: updated.status,
      amount: updated.amount,
      currency: updated.currency,
      redirectUrl: updated.redirectUrl,
      token: updated.providerToken,
    };
  }

  async getPaymentRequest(tenantId: string, id: string) {
    const payment = await prisma.externalPayment.findFirst({
      where: { id, tenantId },
      include: { client: true, credit: true, payment: true },
    });

    if (!payment) {
      throw new AppError("Payment request not found", 404);
    }

    return payment;
  }

  async simulatePayment(tenantId: string, id: string) {
    if ((process.env.PAYTECH_ENV || "test") !== "test") {
      throw new AppError("PayTech simulation is only available in test mode", 403);
    }

    const externalPayment = await prisma.externalPayment.findFirst({
      where: { id, tenantId },
    });

    if (!externalPayment) {
      throw new AppError("Payment request not found", 404);
    }

    if (externalPayment.status === ExternalPaymentStatus.COMPLETED) {
      return this.getPaymentRequest(tenantId, id);
    }

    if (
      externalPayment.status !== ExternalPaymentStatus.INITIATED &&
      externalPayment.status !== ExternalPaymentStatus.PENDING
    ) {
      throw new AppError("Only pending PayTech payments can be simulated", 400);
    }

    await this.completeExternalPayment(externalPayment, {
      amount: externalPayment.amount,
      method: SIMULATED_PAYMENT_METHOD,
      token: externalPayment.providerToken,
      clientPhone: externalPayment.clientPhone,
      rawWebhook: {
        simulated: true,
        type_event: "sale_complete",
        ref_command: externalPayment.refCommand,
        item_price: externalPayment.amount,
        final_item_price: externalPayment.amount,
        payment_method: SIMULATED_PAYMENT_METHOD,
        token: externalPayment.providerToken,
      },
    });

    return this.getPaymentRequest(tenantId, id);
  }

  async handleIpn(payload: PaytechWebhookPayload) {
    this.verifyWebhook(payload);

    const refCommand = payload.ref_command;
    if (!refCommand) {
      throw new AppError("Missing ref_command", 400);
    }

    const externalPayment = await prisma.externalPayment.findUnique({
      where: { refCommand },
    });

    if (!externalPayment) {
      throw new AppError("Payment request not found", 404);
    }

    if (payload.type_event === "sale_canceled") {
      await prisma.externalPayment.update({
        where: { id: externalPayment.id },
        data: {
          status: ExternalPaymentStatus.CANCELLED,
          providerToken: payload.token || externalPayment.providerToken,
          providerMethod: payload.payment_method,
          clientPhone: payload.client_phone || externalPayment.clientPhone,
          rawWebhook: payload as Prisma.InputJsonObject,
        },
      });
      return { processed: true, status: ExternalPaymentStatus.CANCELLED };
    }

    if (payload.type_event !== "sale_complete") {
      return { processed: false, status: externalPayment.status };
    }

    if (externalPayment.status === ExternalPaymentStatus.COMPLETED) {
      return { processed: true, status: externalPayment.status };
    }

    await this.completeExternalPayment(externalPayment, {
      amount: Number(payload.final_item_price || payload.item_price || externalPayment.amount),
      method: payload.payment_method,
      token: payload.token || externalPayment.providerToken,
      clientPhone: payload.client_phone || externalPayment.clientPhone,
      rawWebhook: payload as Prisma.InputJsonObject,
    });

    return { processed: true, status: ExternalPaymentStatus.COMPLETED };
  }

  async handleTransferCallback(payload: Record<string, unknown>) {
    return this.payoutService.handleTransferCallback(payload);
  }

  private async completeExternalPayment(
    externalPayment: ExternalPayment,
    input: {
      amount: number;
      method?: string | null;
      token?: string | null;
      clientPhone?: string | null;
      rawWebhook: Prisma.InputJsonObject;
    }
  ) {
    const paymentMethod = mapPaytechMethod(input.method);
    const paidAt = new Date();

    const payment = await this.paymentService.create(externalPayment.tenantId, {
      clientId: externalPayment.clientId,
      creditId: externalPayment.creditId ?? undefined,
      installmentId: externalPayment.installmentId ?? undefined,
      amount: input.amount,
      method: paymentMethod,
      status: PaymentStatus.COMPLETED,
      reference: externalPayment.refCommand,
      paidAt,
    });

    await prisma.externalPayment.update({
      where: { id: externalPayment.id },
      data: {
        status: ExternalPaymentStatus.COMPLETED,
        paymentId: payment.id,
        providerToken: input.token || externalPayment.providerToken,
        providerMethod: input.method,
        clientPhone: input.clientPhone || externalPayment.clientPhone,
        rawWebhook: input.rawWebhook,
        paidAt,
      },
    });

    await this.payoutService.createAutomaticPayoutForPayment({
      tenantId: externalPayment.tenantId,
      clientId: externalPayment.clientId,
      paymentId: payment.id,
      externalPaymentId: externalPayment.id,
      amount: input.amount,
      paymentMethod,
    });

    return payment;
  }

  private verifyWebhook(payload: PaytechWebhookPayload) {
    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new AppError("PayTech is not configured", 503);
    }

    if (payload.hmac_compute) {
      const amount = payload.final_item_price || payload.item_price;
      const message = `${amount}|${payload.ref_command}|${apiKey}`;
      const expected = crypto
        .createHmac("sha256", apiSecret)
        .update(message)
        .digest("hex");

      const expectedBuffer = Buffer.from(expected);
      const receivedBuffer = Buffer.from(payload.hmac_compute);

      if (
        expectedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        throw new AppError("Invalid PayTech HMAC", 403);
      }
      return;
    }

    const expectedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
    const expectedSecret = crypto
      .createHash("sha256")
      .update(apiSecret)
      .digest("hex");

    if (
      payload.api_key_sha256 !== expectedKey ||
      payload.api_secret_sha256 !== expectedSecret
    ) {
      throw new AppError("Invalid PayTech signature", 403);
    }
  }
}
