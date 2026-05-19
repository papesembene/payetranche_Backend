import { SubscriptionPlan } from "@prisma/client";
import { z } from "zod";

export const updateSubscriptionSchema = z.object({
  body: z.object({
    plan: z.nativeEnum(SubscriptionPlan),
  }),
});

export const createSubscriptionCheckoutSchema = z.object({
  body: z.object({
    plan: z.enum([SubscriptionPlan.PRO]),
    targetPayment: z
      .enum(["Orange Money", "Wave", "Orange Money, Wave"])
      .default("Orange Money, Wave"),
  }),
});

export const subscriptionPaymentIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type UpdateSubscriptionInput = z.infer<
  typeof updateSubscriptionSchema
>["body"];

export type CreateSubscriptionCheckoutInput = z.infer<
  typeof createSubscriptionCheckoutSchema
>["body"];
