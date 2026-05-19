import { z } from "zod";

export const createPaytechPaymentSchema = z.object({
  params: z.object({
    creditId: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().int().min(101).optional(),
    installmentId: z.string().min(1).optional(),
    targetPayment: z
      .enum(["Orange Money", "Wave", "Orange Money, Wave"])
      .default("Orange Money, Wave"),
    clientPhone: z.string().trim().optional(),
  }),
});

export const paytechStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type CreatePaytechPaymentInput = z.infer<
  typeof createPaytechPaymentSchema
>["body"];
