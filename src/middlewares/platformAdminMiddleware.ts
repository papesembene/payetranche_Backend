import { NextFunction, Request, Response } from "express";

const getPlatformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export function platformAdminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const adminEmails = getPlatformAdminEmails();
  const allowDevAdmin = process.env.ALLOW_DEV_ADMIN === "true";
  const email = req.user?.email?.toLowerCase();

  if (!email) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (allowDevAdmin || adminEmails.includes(email)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Platform admin access required",
  });
}
