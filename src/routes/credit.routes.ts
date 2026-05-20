import { Router } from "express";
import { CreditController } from "../controllers/credit.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createCreditSchema,
  creditIdSchema,
  listCreditsSchema,
  updateCreditSchema,
} from "../schemas/credit.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new CreditController();

router.get("/", validateRequest(listCreditsSchema), asyncHandler(controller.list));
router.post(
  "/",
  validateRequest(createCreditSchema),
  asyncHandler(controller.create)
);
router.get("/history", asyncHandler(controller.history));
router.get("/:id", validateRequest(creditIdSchema), asyncHandler(controller.getById));
router.get(
  "/:id/payments",
  validateRequest(creditIdSchema),
  asyncHandler(controller.getPayments)
);
router.get(
  "/:id/timeline",
  validateRequest(creditIdSchema),
  asyncHandler(controller.timeline)
);
router.get(
  "/:id/client-portal",
  validateRequest(creditIdSchema),
  asyncHandler(controller.clientPortalLink)
);
router.patch(
  "/:id",
  validateRequest(updateCreditSchema),
  asyncHandler(controller.update)
);
router.delete(
  "/:id",
  validateRequest(creditIdSchema),
  asyncHandler(controller.delete)
);

export { router as creditRoutes };
