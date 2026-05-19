import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service";

const paymentService = new PaymentService();

export class PaymentController {
  async create(req: Request, res: Response) {
    const payment = await paymentService.create(req.tenantId as string, req.body);
    return res.status(201).json({ success: true, data: payment });
  }

  async list(req: Request, res: Response) {
    const payments = await paymentService.list(req.tenantId as string, req.query as any);
    return res.json({ success: true, data: payments });
  }

  async getById(req: Request, res: Response) {
    const payment = await paymentService.getById(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: payment });
  }
}
