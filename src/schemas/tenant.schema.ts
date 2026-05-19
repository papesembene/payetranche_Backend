import { z } from "zod";

export const createTenantSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
  }),
});
