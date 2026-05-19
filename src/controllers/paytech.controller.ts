import { Request, Response } from "express";
import { PaytechService } from "../services/paytech.service";

const paytechService = new PaytechService();

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

export class PaytechController {
  createPaymentRequest = async (req: Request, res: Response) => {
    const payment = await paytechService.createPaymentRequest({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      creditId: req.params.creditId,
      amount: req.body.amount,
      installmentId: req.body.installmentId,
      targetPayment: req.body.targetPayment,
      clientPhone: req.body.clientPhone,
    });

    return res.status(201).json({ success: true, data: payment });
  };

  getPaymentRequest = async (req: Request, res: Response) => {
    const payment = await paytechService.getPaymentRequest(
      req.tenantId!,
      req.params.id
    );

    return res.json({ success: true, data: payment });
  };

  simulatePayment = async (req: Request, res: Response) => {
    const payment = await paytechService.simulatePayment(
      req.tenantId!,
      req.params.id
    );

    return res.json({ success: true, data: payment });
  };

  ipn = async (req: Request, res: Response) => {
    await paytechService.handleIpn(req.body);
    return res.status(200).send("OK");
  };

  transferCallback = async (req: Request, res: Response) => {
    await paytechService.handleTransferCallback(req.body);
    return res.status(200).send("OK");
  };

  redirectSuccess = async (req: Request, res: Response) => {
    return redirectToFrontend(res, "/payment/success", req.query);
  };

  redirectCancel = async (req: Request, res: Response) => {
    return redirectToFrontend(res, "/payment/cancel", req.query);
  };
}
