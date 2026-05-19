import { Request, Response } from "express";
import { TenantService } from "../services/tenant.service";

const tenantService = new TenantService();

export class TenantController {
  async me(req: Request, res: Response) {
    const tenant = await tenantService.findById(req.tenantId as string);
    return res.json({ success: true, data: tenant });
  }
}
