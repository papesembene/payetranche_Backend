import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  adminPayoutIdSchema,
  adminTenantIdSchema,
  listAdminPayoutsSchema,
  listAdminTenantsSchema,
  updateAdminPlanSchema,
  updateTenantStatusSchema,
} from "../schemas/admin.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new AdminController();

router.get("/overview", asyncHandler(controller.overview));
router.get("/payment-config", asyncHandler(controller.paymentConfig));
router.get(
  "/tenants",
  validateRequest(listAdminTenantsSchema),
  asyncHandler(controller.tenants)
);
router.get(
  "/tenants/:tenantId",
  validateRequest(adminTenantIdSchema),
  asyncHandler(controller.tenant)
);
router.patch(
  "/tenants/:tenantId/status",
  validateRequest(updateTenantStatusSchema),
  asyncHandler(controller.updateTenantStatus)
);
router.patch(
  "/users/:userId/plan",
  validateRequest(updateAdminPlanSchema),
  asyncHandler(controller.updateUserPlan)
);
router.get("/subscription-payments", asyncHandler(controller.subscriptionPayments));
router.get(
  "/payouts",
  validateRequest(listAdminPayoutsSchema),
  asyncHandler(controller.payouts)
);
router.post(
  "/payouts/:payoutId/sync",
  validateRequest(adminPayoutIdSchema),
  asyncHandler(controller.syncPayout)
);
router.post(
  "/payouts/:payoutId/send",
  validateRequest(adminPayoutIdSchema),
  asyncHandler(controller.sendPayout)
);

export { router as adminRoutes };
