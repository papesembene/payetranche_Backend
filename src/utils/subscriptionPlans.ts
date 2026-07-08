import { SubscriptionPlan } from "@prisma/client";

export const PLAN_LIMITS = {
  [SubscriptionPlan.GRATUIT]: {
    maxClients: 10,
  },
  [SubscriptionPlan.PRO]: {
    maxClients: null,
  },
  [SubscriptionPlan.ENTREPRISE]: {
    maxClients: null,
  },
} as const;

export const PLAN_FEATURES = {
  [SubscriptionPlan.GRATUIT]: ["clients:read", "clients:create_limited"],
  [SubscriptionPlan.PRO]: ["clients:unlimited", "credits", "payments", "analytics"],
  [SubscriptionPlan.ENTREPRISE]: [
    "clients:unlimited",
    "credits",
    "payments",
    "analytics",
    "advanced_support",
  ],
} as const;
