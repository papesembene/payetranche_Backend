import { NextFunction, Request, Response } from "express";
import { verifyJwt } from "../utils/jwt";
import { userModel } from "../models/user.model";
import { prisma } from "../utils/prisma";

const getPlatformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isPlatformAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return (
    process.env.ALLOW_DEV_ADMIN === "true" ||
    getPlatformAdminEmails().includes(email.toLowerCase())
  );
};

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.header("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token",
      });
    }

    const payload = verifyJwt(token);

    if (req.tenantId && req.tenantId !== payload.tenantId) {
      return res.status(403).json({
        success: false,
        message: "Token tenant does not match request tenant",
      });
    }

    const user = await userModel.findById(payload.tenantId, payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { isActive: true },
    });

    if (!tenant?.isActive && !isPlatformAdminEmail(user.email)) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message: "Votre compte est bloqué. Contactez PayTranche.",
      });
    }

    let plan = user.plan;
    let planExpiresAt = user.planExpiresAt;

    if (plan !== "GRATUIT" && planExpiresAt && planExpiresAt <= new Date()) {
      const downgradedUser = await prisma.user.update({
        where: { id: user.id },
        data: { plan: "GRATUIT", planExpiresAt: null },
      });
      plan = downgradedUser.plan;
      planExpiresAt = downgradedUser.planExpiresAt;
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      plan,
      planExpiresAt,
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
