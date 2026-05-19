import { PayoutOperator } from "@prisma/client";
import { z } from "zod";

const payoutAccountSchema = z.object({
  operator: z.nativeEnum(PayoutOperator),
  phone: z.string().trim().min(8),
  holderName: z.string().trim().min(2),
  isDefault: z.boolean().optional(),
});

export const completeOnboardingSchema = z.object({
  body: z.object({
    companyName: z.string().trim().min(2),
    phone: z.string().trim().min(8),
    payoutAccounts: z.array(payoutAccountSchema).min(1),
  }),
});

export type CompleteOnboardingInput = z.infer<
  typeof completeOnboardingSchema
>["body"];
