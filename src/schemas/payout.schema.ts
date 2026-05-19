import { PayoutOperator, PayoutStatus } from "@prisma/client";
import { z } from "zod";

export const upsertPayoutProfileSchema = z.object({
  body: z.object({
    operator: z.nativeEnum(PayoutOperator),
    phone: z.string().trim().min(8),
    holderName: z.string().trim().min(2),
    isDefault: z.boolean().optional(),
  }),
});

export const listPayoutsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(PayoutStatus).optional(),
  }),
});

export const payoutIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type UpsertPayoutProfileInput = z.infer<
  typeof upsertPayoutProfileSchema
>["body"];
