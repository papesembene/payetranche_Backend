import { SubscriptionPlan } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { PLAN_LIMITS } from "../utils/subscriptionPlans";
import { prisma } from "../utils/prisma";

export function requirePlan(allowedPlans: SubscriptionPlan[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const plan = req.user?.plan;

    if (!plan || !allowedPlans.includes(plan as SubscriptionPlan)) {
      return res.status(403).json({
        success: false,
        message: "Your current plan does not allow this action",
        requiredPlans: allowedPlans,
        currentPlan: plan,
      });
    }

    return next();
  };
}

export async function enforceClientLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.tenantId;
    const plan = req.user?.plan as SubscriptionPlan | undefined;

    if (!tenantId || !plan) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const maxClients = PLAN_LIMITS[plan].maxClients;

    if (maxClients === null) {
      return next();
    }

    const clientsCount = await prisma.client.count({
      where: { tenantId, isActive: true },
    });

    if (clientsCount >= maxClients) {
      return res.status(403).json({
        success: false,
        message: `Client limit reached for ${plan} plan`,
        plan,
        limit: maxClients,
        currentUsage: clientsCount,
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
