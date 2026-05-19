import { Router } from "express";
import { PayoutController } from "../controllers/payout.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  listPayoutsSchema,
  payoutIdSchema,
  upsertPayoutProfileSchema,
} from "../schemas/payout.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new PayoutController();

router.get("/profile", asyncHandler(controller.getProfile));
router.put(
  "/profile",
  validateRequest(upsertPayoutProfileSchema),
  asyncHandler(controller.upsertProfile)
);
router.get("/wallet", asyncHandler(controller.getWallet));
router.get(
  "/payouts",
  validateRequest(listPayoutsSchema),
  asyncHandler(controller.listPayouts)
);
router.post(
  "/payouts/:id/send",
  validateRequest(payoutIdSchema),
  asyncHandler(controller.initiateTransfer)
);
router.post(
  "/payouts/:id/sync",
  validateRequest(payoutIdSchema),
  asyncHandler(controller.syncTransfer)
);

export { router as payoutRoutes };
