import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { validateRequest } from "../middlewares/validateRequest";
import { alertIdSchema, listAlertsSchema } from "../schemas/notification.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new NotificationController();

router.get(
  "/alerts",
  validateRequest(listAlertsSchema),
  asyncHandler(controller.listAlerts)
);
router.patch(
  "/alerts/:id/read",
  validateRequest(alertIdSchema),
  asyncHandler(controller.markAsRead)
);
router.post("/scan-overdue", asyncHandler(controller.scanOverdue));

export { router as notificationRoutes };
