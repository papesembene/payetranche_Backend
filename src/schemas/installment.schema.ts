import { InstallmentStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const createInstallmentPlanSchema = z.object({
  params: z.object({
    creditId: z.string().min(1),
  }),
  body: z.object({
    count: z.number().int().min(1).max(24),
    firstDueDate: dateString,
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("MONTHLY"),
  }),
});

export const listInstallmentsSchema = z.object({
  query: z.object({
    creditId: z.string().optional(),
    clientId: z.string().optional(),
    status: z.nativeEnum(InstallmentStatus).optional(),
  }),
});

export const installmentIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type CreateInstallmentPlanInput = z.infer<
  typeof createInstallmentPlanSchema
>["body"];
