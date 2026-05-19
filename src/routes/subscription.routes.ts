import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createSubscriptionCheckoutSchema,
  subscriptionPaymentIdSchema,
  updateSubscriptionSchema,
} from "../schemas/subscription.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new SubscriptionController();

router.get("/me", asyncHandler(controller.me));
router.get("/history", asyncHandler(controller.history));
router.post(
  "/checkout",
  validateRequest(createSubscriptionCheckoutSchema),
  asyncHandler(controller.checkout)
);
router.get(
  "/payments/:id",
  validateRequest(subscriptionPaymentIdSchema),
  asyncHandler(controller.payment)
);
router.patch(
  "/me",
  validateRequest(updateSubscriptionSchema),
  asyncHandler(controller.update)
);

export { router as subscriptionRoutes };
