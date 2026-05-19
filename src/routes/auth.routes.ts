import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { tenantMiddleware } from "../middlewares/tenantMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import { loginSchema, registerSchema, socialLoginSchema } from "../schemas/auth.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new AuthController();

router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(controller.register)
);

router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(controller.login)
);

router.post(
  "/social",
  validateRequest(socialLoginSchema),
  asyncHandler(controller.socialLogin)
);

router.get(
  "/me",
  tenantMiddleware,
  authMiddleware,
  asyncHandler(controller.me)
);

export { router as authRoutes };
