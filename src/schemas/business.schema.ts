import { BusinessEntryType, BusinessPaymentStatus } from "@prisma/client";
import { z } from "zod";

const optionalDateString = z
  .string()
  .datetime()
  .transform((value) => new Date(value))
  .optional();

export const createBusinessEntrySchema = z.object({
  body: z.object({
    type: z.nativeEnum(BusinessEntryType),
    title: z.string().trim().min(2),
    amount: z.number().int().positive(),
    paidAmount: z.number().int().min(0).optional(),
    supplierId: z.string().min(1).optional(),
    supplierName: z.string().trim().min(2).optional(),
    supplierPhone: z.string().trim().optional(),
    note: z.string().trim().optional(),
    occurredAt: optionalDateString,
  }),
});

export const listBusinessEntriesSchema = z.object({
  query: z.object({
    type: z.nativeEnum(BusinessEntryType).optional(),
    supplierId: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

export const businessEntryIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const businessSummarySchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

export type CreateBusinessEntryInput = z.infer<
  typeof createBusinessEntrySchema
>["body"];

export type ListBusinessEntriesInput = z.infer<
  typeof listBusinessEntriesSchema
>["query"];

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>["body"];

export const resolveBusinessPaymentStatus = (
  amount: number,
  paidAmount: number
) => {
  if (paidAmount <= 0) return BusinessPaymentStatus.UNPAID;
  if (paidAmount >= amount) return BusinessPaymentStatus.PAID;
  return BusinessPaymentStatus.PARTIAL;
};
