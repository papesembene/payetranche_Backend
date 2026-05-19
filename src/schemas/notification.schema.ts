import { AlertStatus, AlertType } from "@prisma/client";
import { z } from "zod";

export const listAlertsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(AlertStatus).optional(),
    type: z.nativeEnum(AlertType).optional(),
    clientId: z.string().optional(),
  }),
});

export const alertIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
