import { z } from "zod";

export const clientPortalTokenSchema = z.object({
  params: z.object({
    token: z.string().min(20),
  }),
});

export const clientPortalPaymentSchema = z.object({
  params: z.object({
    token: z.string().min(20),
  }),
  body: z.object({
    targetPayment: z
      .enum(["Orange Money", "Wave", "Orange Money, Wave"])
      .default("Orange Money, Wave"),
  }),
});
