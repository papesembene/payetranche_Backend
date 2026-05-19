import { Router } from "express";
import { OnboardingController } from "../controllers/onboarding.controller";
import { validateRequest } from "../middlewares/validateRequest";
import { completeOnboardingSchema } from "../schemas/onboarding.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new OnboardingController();

router.get("/status", asyncHandler(controller.status));
router.put(
  "/complete",
  validateRequest(completeOnboardingSchema),
  asyncHandler(controller.complete)
);

export { router as onboardingRoutes };
