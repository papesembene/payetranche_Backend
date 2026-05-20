import { Request, Response } from "express";
import { CreditService } from "../services/credit.service";

const creditService = new CreditService();

export class CreditController {
  async create(req: Request, res: Response) {
    const credit = await creditService.create(req.tenantId as string, req.body);
    return res.status(201).json({ success: true, data: credit });
  }

  async list(req: Request, res: Response) {
    const credits = await creditService.list(req.tenantId as string, req.query as any);
    return res.json({ success: true, data: credits });
  }

  async history(req: Request, res: Response) {
    const credits = await creditService.history(
      req.tenantId as string,
      req.query.clientId as string | undefined
    );
    return res.json({ success: true, data: credits });
  }

  async getById(req: Request, res: Response) {
    const credit = await creditService.getById(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: credit });
  }

  async getPayments(req: Request, res: Response) {
    const payments = await creditService.getPayments(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: payments });
  }

  async timeline(req: Request, res: Response) {
    const events = await creditService.timeline(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: events });
  }

  async clientPortalLink(req: Request, res: Response) {
    const link = await creditService.getClientPortalLink(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: link });
  }

  async update(req: Request, res: Response) {
    const credit = await creditService.update(
      req.tenantId as string,
      req.params.id,
      req.body
    );
    return res.json({ success: true, data: credit });
  }

  async delete(req: Request, res: Response) {
    const result = await creditService.delete(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: result });
  }
}
