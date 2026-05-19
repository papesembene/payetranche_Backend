import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";

const adminService = new AdminService();

export class AdminController {
  async overview(_req: Request, res: Response) {
    const data = await adminService.overview();
    return res.json({ success: true, data });
  }

  async tenants(req: Request, res: Response) {
    const data = await adminService.listTenants(req.query.search as string | undefined);
    return res.json({ success: true, data });
  }

  async tenant(req: Request, res: Response) {
    const data = await adminService.getTenant(req.params.tenantId);
    return res.json({ success: true, data });
  }

  async updateTenantStatus(req: Request, res: Response) {
    const data = await adminService.updateTenantStatus(
      req.params.tenantId,
      req.body.isActive
    );
    return res.json({ success: true, data });
  }

  async updateUserPlan(req: Request, res: Response) {
    const data = await adminService.updateUserPlan(req.params.userId, req.body);
    return res.json({ success: true, data });
  }

  async subscriptionPayments(_req: Request, res: Response) {
    const data = await adminService.listSubscriptionPayments();
    return res.json({ success: true, data });
  }

  async paymentConfig(_req: Request, res: Response) {
    const data = await adminService.paymentConfig();
    return res.json({ success: true, data });
  }

  async payouts(req: Request, res: Response) {
    const data = await adminService.listPayouts({
      search: req.query.search as string | undefined,
      status: req.query.status as any,
    });
    return res.json({ success: true, data });
  }

  async syncPayout(req: Request, res: Response) {
    const data = await adminService.syncPayout(req.params.payoutId);
    return res.json({ success: true, data });
  }

  async sendPayout(req: Request, res: Response) {
    const data = await adminService.sendPayout(req.params.payoutId);
    return res.json({ success: true, data });
  }
}
