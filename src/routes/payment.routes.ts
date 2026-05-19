import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createPaymentSchema,
  listPaymentsSchema,
  paymentIdSchema,
} from "../schemas/payment.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new PaymentController();

router.get("/", validateRequest(listPaymentsSchema), asyncHandler(controller.list));
router.post(
  "/",
  validateRequest(createPaymentSchema),
  asyncHandler(controller.create)
);
router.get("/:id", validateRequest(paymentIdSchema), asyncHandler(controller.getById));

export { router as paymentRoutes };
