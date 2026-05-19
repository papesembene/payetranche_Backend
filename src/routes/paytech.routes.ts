import { Router } from "express";
import { PaytechController } from "../controllers/paytech.controller";
import {
  createPaytechPaymentSchema,
  paytechStatusSchema,
} from "../schemas/paytech.schema";
import { asyncHandler } from "../utils/asyncHandler";
import { validateRequest } from "../middlewares/validateRequest";
import { authMiddleware } from "../middlewares/authMiddleware";
import { tenantMiddleware } from "../middlewares/tenantMiddleware";

const router = Router();
const controller = new PaytechController();

router.get("/redirect/success", asyncHandler(controller.redirectSuccess));
router.get("/redirect/cancel", asyncHandler(controller.redirectCancel));

router.post(
  "/credits/:creditId/request-payment",
  tenantMiddleware,
  authMiddleware,
  validateRequest(createPaytechPaymentSchema),
  asyncHandler(controller.createPaymentRequest)
);

router.get(
  "/payments/:id",
  tenantMiddleware,
  authMiddleware,
  validateRequest(paytechStatusSchema),
  asyncHandler(controller.getPaymentRequest)
);

router.post(
  "/payments/:id/simulate",
  tenantMiddleware,
  authMiddleware,
  validateRequest(paytechStatusSchema),
  asyncHandler(controller.simulatePayment)
);

router.post("/ipn", asyncHandler(controller.ipn));
router.post("/transfer-callback", asyncHandler(controller.transferCallback));

export { router as paytechRoutes };
