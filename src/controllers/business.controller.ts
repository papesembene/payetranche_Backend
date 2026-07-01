import { Request, Response } from "express";
import { BusinessService } from "../services/business.service";

const businessService = new BusinessService();

export class BusinessController {
  createEntry = async (req: Request, res: Response) => {
    const entry = await businessService.createEntry(req.tenantId!, req.body);
    return res.status(201).json({ success: true, data: entry });
  };

  listEntries = async (req: Request, res: Response) => {
    const entries = await businessService.listEntries(req.tenantId!, req.query);
    return res.json({ success: true, data: entries });
  };

  deleteEntry = async (req: Request, res: Response) => {
    const result = await businessService.deleteEntry(req.tenantId!, req.params.id);
    return res.json({ success: true, data: result });
  };

  getSummary = async (req: Request, res: Response) => {
    const summary = await businessService.summary(
      req.tenantId!,
      req.query.from as string | undefined,
      req.query.to as string | undefined
    );
    return res.json({ success: true, data: summary });
  };

  createSupplier = async (req: Request, res: Response) => {
    const supplier = await businessService.createSupplier(req.tenantId!, req.body);
    return res.status(201).json({ success: true, data: supplier });
  };

  listSuppliers = async (req: Request, res: Response) => {
    const suppliers = await businessService.listSuppliers(req.tenantId!);
    return res.json({ success: true, data: suppliers });
  };
}
