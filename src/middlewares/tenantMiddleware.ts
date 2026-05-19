import { NextFunction, Request, Response } from "express";

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: "Missing x-tenant-id header",
    });
  }

  req.tenantId = tenantId;
  return next();
}
