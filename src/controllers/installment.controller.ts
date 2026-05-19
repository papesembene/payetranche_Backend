import { Request, Response } from "express";
import { InstallmentService } from "../services/installment.service";

const installmentService = new InstallmentService();

export class InstallmentController {
  createPlan = async (req: Request, res: Response) => {
    const installments = await installmentService.createPlan(
      req.tenantId!,
      req.params.creditId,
      req.body
    );

    return res.status(201).json({ success: true, data: installments });
  };

  list = async (req: Request, res: Response) => {
    const installments = await installmentService.list(req.tenantId!, req.query);
    return res.json({ success: true, data: installments });
  };

  getById = async (req: Request, res: Response) => {
    const installment = await installmentService.getById(req.tenantId!, req.params.id);
    return res.json({ success: true, data: installment });
  };

  pay = async (req: Request, res: Response) => {
    const payment = await installmentService.pay(
      req.tenantId!,
      req.params.id,
      req.body?.amount
    );
    return res.status(201).json({ success: true, data: payment });
  };

  scanOverdue = async (req: Request, res: Response) => {
    const installments = await installmentService.markOverdue(req.tenantId!);
    return res.json({ success: true, data: installments });
  };
}
