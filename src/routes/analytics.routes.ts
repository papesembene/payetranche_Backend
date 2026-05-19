import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new AnalyticsController();

router.get("/dashboard", asyncHandler(controller.dashboard));

export { router as analyticsRoutes };
