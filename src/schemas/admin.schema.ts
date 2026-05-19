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

export type UpdateAdminPlanInput = z.infer<typeof updateAdminPlanSchema>["body"];
export type ListAdminPayoutsInput = z.infer<
  typeof listAdminPayoutsSchema
>["query"];
