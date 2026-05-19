import { Router } from "express";
import { SubscriptionPlan } from "@prisma/client";
import { ClientController } from "../controllers/client.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { validateRequest } from "../middlewares/validateRequest";
import { enforceClientLimit, requirePlan } from "../middlewares/planMiddleware";
import {
  clientIdSchema,
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
} from "../schemas/client.schema";

const router = Router();
const controller = new ClientController();

router.get("/", validateRequest(listClientsSchema), asyncHandler(controller.list));
router.post(
  "/",
  requirePlan([
    SubscriptionPlan.GRATUIT,
    SubscriptionPlan.PRO,
    SubscriptionPlan.ENTREPRISE,
  ]),
  enforceClientLimit,
  validateRequest(createClientSchema),
  asyncHandler(controller.create)
);
router.get("/:id", validateRequest(clientIdSchema), asyncHandler(controller.getById));
router.patch(
  "/:id",
  validateRequest(updateClientSchema),
  asyncHandler(controller.update)
);
router.delete(
  "/:id",
  validateRequest(clientIdSchema),
  asyncHandler(controller.delete)
);

export { router as clientRoutes };
