import { Router } from "express";
import { InstallmentController } from "../controllers/installment.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createInstallmentPlanSchema,
  installmentIdSchema,
  listInstallmentsSchema,
} from "../schemas/installment.schema";
import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

const router = Router();
const controller = new InstallmentController();

const payInstallmentSchema = z.object({
  params: installmentIdSchema.shape.params,
  body: z.object({
    amount: z.number().int().positive().optional(),
    method: z.nativeEnum(PaymentMethod).optional(),
    reference: z.string().trim().optional(),
  }),
});

const payMultipleInstallmentsSchema = z.object({
  params: z.object({
    creditId: z.string().min(1),
  }),
  body: z.object({
    installmentIds: z.array(z.string().min(1)).min(1).max(24),
    method: z.nativeEnum(PaymentMethod).optional(),
    reference: z.string().trim().optional(),
  }),
});

router.get("/", validateRequest(listInstallmentsSchema), asyncHandler(controller.list));
router.post(
  "/credits/:creditId/plan",
  validateRequest(createInstallmentPlanSchema),
  asyncHandler(controller.createPlan)
);
router.post(
  "/credits/:creditId/pay-multiple",
  validateRequest(payMultipleInstallmentsSchema),
  asyncHandler(controller.payMultiple)
);
router.post("/scan-overdue", asyncHandler(controller.scanOverdue));
router.get("/:id", validateRequest(installmentIdSchema), asyncHandler(controller.getById));
router.post("/:id/pay", validateRequest(payInstallmentSchema), asyncHandler(controller.pay));

export { router as installmentRoutes };
