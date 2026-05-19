import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        requiredRoles: roles,
        currentRole: req.user.role,
      });
    }

    return next();
  };
