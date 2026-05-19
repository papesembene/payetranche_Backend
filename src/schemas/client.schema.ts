import { ClientStatus } from "@prisma/client";
import { z } from "zod";

export const createClientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().optional(),
    totalDebt: z.number().int().min(0).default(0),
    status: z.nativeEnum(ClientStatus).default(ClientStatus.BON),
    address: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const updateClientSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().nullable().optional(),
      totalDebt: z.number().int().min(0).optional(),
      status: z.nativeEnum(ClientStatus).optional(),
      address: z.string().trim().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

export const clientIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listClientsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    status: z.nativeEnum(ClientStatus).optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  }),
});

export type CreateClientInput = z.infer<typeof createClientSchema>["body"];
export type UpdateClientInput = z.infer<typeof updateClientSchema>["body"];
