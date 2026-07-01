import { Router } from "express";
import { BusinessController } from "../controllers/business.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  businessEntryIdSchema,
  businessSummarySchema,
  createBusinessEntrySchema,
  createSupplierSchema,
  listBusinessEntriesSchema,
} from "../schemas/business.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const controller = new BusinessController();

router.get("/summary", validateRequest(businessSummarySchema), asyncHandler(controller.getSummary));
router.get("/entries", validateRequest(listBusinessEntriesSchema), asyncHandler(controller.listEntries));
router.post("/entries", validateRequest(createBusinessEntrySchema), asyncHandler(controller.createEntry));
router.delete("/entries/:id", validateRequest(businessEntryIdSchema), asyncHandler(controller.deleteEntry));
router.get("/suppliers", asyncHandler(controller.listSuppliers));
router.post("/suppliers", validateRequest(createSupplierSchema), asyncHandler(controller.createSupplier));

export { router as businessRoutes };
