import { z } from "zod";

export const socialLoginSchema = z.object({
  body: z.object({
    idToken: z.string().min(20),
    provider: z.enum(["firebase", "google"]).optional(),
    companyName: z.string().trim().min(2).optional(),
  }),
});

export type SocialLoginInput = z.infer<typeof socialLoginSchema>["body"];
