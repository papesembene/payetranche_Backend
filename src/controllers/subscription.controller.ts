import { Request, Response } from "express";
import { SubscriptionService } from "../services/subscription.service";

const subscriptionService = new SubscriptionService();

const getFrontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

const redirectToFrontend = (
  res: Response,
  path: string,
  query: Request["query"]
) => {
  const target = new URL(path, getFrontendUrl());

  Object.entries(query).forEach(([key, rawValue]) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value === "string") {
      target.searchParams.set(key, value);
    }
  });

  return res.redirect(302, target.toString());
};

export class SubscriptionController {
  async me(req: Request, res: Response) {
    const subscription = await subscriptionService.getCurrentPlan(
      req.user!.id,
      req.tenantId as string
    );

    return res.json({ success: true, data: subscription });
  }

  async update(req: Request, res: Response) {
    const subscription = await subscriptionService.updatePlan(
      req.user!.id,
      req.tenantId as string,
      req.body.plan
    );

    return res.json({ success: true, data: subscription });
  }

  async checkout(req: Request, res: Response) {
    const checkout = await subscriptionService.createCheckout(
      req.user!.id,
      req.tenantId as string,
      req.body
    );

    return res.status(201).json({ success: true, data: checkout });
  }

  async payment(req: Request, res: Response) {
    const payment = await subscriptionService.getPayment(
      req.tenantId as string,
      req.params.id
    );

    return res.json({ success: true, data: payment });
  }

  async history(req: Request, res: Response) {
    const payments = await subscriptionService.listPayments(req.tenantId as string);
    return res.json({ success: true, data: payments });
  }

  async ipn(req: Request, res: Response) {
    await subscriptionService.handleIpn(req.body);
    return res.status(200).send("OK");
  }

  async redirectSuccess(req: Request, res: Response) {
    return redirectToFrontend(res, "/settings", req.query);
  }

  async redirectCancel(req: Request, res: Response) {
    return redirectToFrontend(res, "/settings", req.query);
  }
}
