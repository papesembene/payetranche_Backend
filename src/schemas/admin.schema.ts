import { PayoutStatus, SubscriptionPlan } from "@prisma/client";
import { z } from "zod";

export const listAdminTenantsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
  }),
});

export const adminTenantIdSchema = z.object({
  params: z.object({
    tenantId: z.string().min(1),
  }),
});

export const listAdminPayoutsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    status: z.nativeEnum(PayoutStatus).optional(),
  }),
});

export const adminPayoutIdSchema = z.object({
  params: z.object({
    payoutId: z.string().min(1),
  }),
});

const payoutOperatorSchema = z.enum(["WAVE", "ORANGE_MONEY"]);

export const updateTenantStatusSchema = z.object({
  params: z.object({
    tenantId: z.string().min(1),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const updateAdminPlanSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    plan: z.nativeEnum(SubscriptionPlan),
    planExpiresAt: z.string().datetime().nullable().optional(),
  }),
});

export const updateAdminPayoutDestinationSchema = z.object({
  params: z.object({
    payoutId: z.string().min(1),
  }),
  body: z.object({
    operator: payoutOperatorSchema,
    phone: z.string().trim().min(8).max(20),
    holderName: z.string().trim().min(2).max(120),
  }),
});

export const markAdminPayoutManualSchema = z.object({
  params: z.object({
    payoutId: z.string().min(1),
  }),
  body: z.object({
    reference: z.string().trim().min(2).max(120),
    note: z.string().trim().max(500).optional(),
  }),
});

export type UpdateAdminPlanInput = z.infer<typeof updateAdminPlanSchema>["body"];
export type ListAdminPayoutsInput = z.infer<
  typeof listAdminPayoutsSchema
>["query"];
export type UpdateAdminPayoutDestinationInput = z.infer<
  typeof updateAdminPayoutDestinationSchema
>["body"];
export type MarkAdminPayoutManualInput = z.infer<
  typeof markAdminPayoutManualSchema
>["body"];
