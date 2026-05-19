import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { platformAdminMiddleware } from "../middlewares/platformAdminMiddleware";
import { tenantMiddleware } from "../middlewares/tenantMiddleware";
import { analyticsRoutes } from "./analytics.routes";
import { adminRoutes } from "./admin.routes";
import { authRoutes } from "./auth.routes";
import { clientRoutes } from "./client.routes";
import { creditRoutes } from "./credit.routes";
import { notificationRoutes } from "./notification.routes";
import { onboardingRoutes } from "./onboarding.routes";
import { paymentRoutes } from "./payment.routes";
import { paytechRoutes } from "./paytech.routes";
import { payoutRoutes } from "./payout.routes";
import { installmentRoutes } from "./installment.routes";
import { subscriptionPublicRoutes } from "./subscription-public.routes";
import { subscriptionRoutes } from "./subscription.routes";
import { tenantRoutes } from "./tenant.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "paytranche-api",
    status: "ok",
  });
});

const protectedTenantRoute = [tenantMiddleware, authMiddleware];

router.use("/auth", authRoutes);
router.use("/subscription", subscriptionPublicRoutes);
router.use("/admin", authMiddleware, platformAdminMiddleware, adminRoutes);
router.use("/tenants", ...protectedTenantRoute, tenantRoutes);
router.use("/clients", ...protectedTenantRoute, clientRoutes);
router.use("/credits", ...protectedTenantRoute, creditRoutes);
router.use("/payments", ...protectedTenantRoute, paymentRoutes);
router.use("/installments", ...protectedTenantRoute, installmentRoutes);
router.use("/onboarding", ...protectedTenantRoute, onboardingRoutes);
router.use("/paytech", paytechRoutes);
router.use("/payout", ...protectedTenantRoute, payoutRoutes);
router.use("/analytics", ...protectedTenantRoute, analyticsRoutes);
router.use("/subscription", ...protectedTenantRoute, subscriptionRoutes);
router.use("/notifications", ...protectedTenantRoute, notificationRoutes);

export { router };
