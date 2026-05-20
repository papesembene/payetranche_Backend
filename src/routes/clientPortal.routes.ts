import { Router } from "express";
import { ClientPortalController } from "../controllers/clientPortal.controller";
import {
  clientPortalPaymentSchema,
  clientPortalTokenSchema,
} from "../schemas/clientPortal.schema";
import { validateRequest } from "../middlewares/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new ClientPortalController();

router.get(
  "/:token",
  validateRequest(clientPortalTokenSchema),
  asyncHandler(controller.getPortal)
);

router.post(
  "/:token/pay-next",
  validateRequest(clientPortalPaymentSchema),
  asyncHandler(controller.payNext)
);

export { router as clientPortalRoutes };
