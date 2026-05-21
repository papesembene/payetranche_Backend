import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { tenantMiddleware } from "../middlewares/tenantMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import { socialLoginSchema } from "../schemas/auth.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new AuthController();

router.post(
  "/social",
  validateRequest(socialLoginSchema),
  asyncHandler(controller.socialLogin),
);

router.get(
  "/me",
  tenantMiddleware,
  authMiddleware,
  asyncHandler(controller.me),
);

export { router as authRoutes };
