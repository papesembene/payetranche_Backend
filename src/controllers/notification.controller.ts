import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";

const notificationService = new NotificationService();

export class NotificationController {
  async listAlerts(req: Request, res: Response) {
    const alerts = await notificationService.listAlerts(
      req.tenantId as string,
      req.query as any
    );

    return res.json({ success: true, data: alerts });
  }

  async markAsRead(req: Request, res: Response) {
    const alert = await notificationService.markAsRead(
      req.tenantId as string,
      req.params.id
    );

    return res.json({ success: true, data: alert });
  }

  async scanOverdue(req: Request, res: Response) {
    const result = await notificationService.scanOverduePayments(
      req.tenantId as string
    );

    return res.json({ success: true, data: result });
  }

  async todayReminders(req: Request, res: Response) {
    const reminders = await notificationService.listWhatsAppReminders(
      req.tenantId as string
    );

    return res.json({ success: true, data: reminders });
  }

  async markWhatsAppReminder(req: Request, res: Response) {
    const reminder = await notificationService.markWhatsAppReminderPrepared(
      req.tenantId as string,
      req.params.type as "credit" | "installment",
      req.params.id
    );

    return res.json({ success: true, data: reminder });
  }
}
