import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    companyName: z.string().trim().min(2),
    name: z.string().trim().min(2),
    phone: z.string().trim().min(8).optional(),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(8),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(1),
  }),
});

export const socialLoginSchema = z.object({
  body: z.object({
    idToken: z.string().min(20),
    provider: z.enum(["firebase", "google"]).optional(),
    companyName: z.string().trim().min(2).optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type SocialLoginInput = z.infer<typeof socialLoginSchema>["body"];
