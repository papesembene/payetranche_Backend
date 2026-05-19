import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new SubscriptionController();

router.get("/redirect/success", asyncHandler(controller.redirectSuccess));
router.get("/redirect/cancel", asyncHandler(controller.redirectCancel));
router.post("/ipn", asyncHandler(controller.ipn));

export { router as subscriptionPublicRoutes };
