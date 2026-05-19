import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const createPaymentSchema = z.object({
  body: z.object({
    clientId: z.string().min(1),
    creditId: z.string().min(1).optional(),
    installmentId: z.string().min(1).optional(),
    amount: z.number().int().positive(),
    method: z.nativeEnum(PaymentMethod).optional(),
    status: z.nativeEnum(PaymentStatus).optional(),
    reference: z.string().trim().optional(),
    paidAt: dateString.optional(),
  }),
});

export const paymentIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    clientId: z.string().optional(),
    creditId: z.string().optional(),
    installmentId: z.string().optional(),
    status: z.nativeEnum(PaymentStatus).optional(),
  }),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>["body"];
