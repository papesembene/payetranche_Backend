import { Router } from "express";
import { TenantController } from "../controllers/tenant.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new TenantController();

router.get("/me", asyncHandler(controller.me));

export { router as tenantRoutes };
