import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async dashboard(req: Request, res: Response) {
    const metrics = await analyticsService.getDashboardMetrics(
      req.tenantId as string
    );

    return res.json({ success: true, data: metrics });
  }
}
