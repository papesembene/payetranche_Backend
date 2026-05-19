import { CreditStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const createCreditSchema = z.object({
  body: z.object({
    clientId: z.string().min(1),
    amount: z.number().int().positive(),
    paidAmount: z.number().int().min(0).default(0),
    description: z.string().trim().optional(),
    dueDate: dateString.optional(),
  }),
});

export const updateCreditSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      amount: z.number().int().positive().optional(),
      paidAmount: z.number().int().min(0).optional(),
      description: z.string().trim().nullable().optional(),
      dueDate: dateString.nullable().optional(),
      status: z.nativeEnum(CreditStatus).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

export const creditIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listCreditsSchema = z.object({
  query: z.object({
    clientId: z.string().optional(),
    status: z.nativeEnum(CreditStatus).optional(),
    includePaid: z.enum(["true", "false"]).optional(),
  }),
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>["body"];
export type UpdateCreditInput = z.infer<typeof updateCreditSchema>["body"];
