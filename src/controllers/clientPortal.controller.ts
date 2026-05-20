import { Request, Response } from "express";
import { ClientPortalService } from "../services/clientPortal.service";

const clientPortalService = new ClientPortalService();

export class ClientPortalController {
  async getPortal(req: Request, res: Response) {
    const data = await clientPortalService.getPortal(req.params.token);
    return res.json({ success: true, data });
  }

  async payNext(req: Request, res: Response) {
    const data = await clientPortalService.createNextPayment(
      req.params.token,
      req.body.targetPayment
    );
    return res.status(201).json({ success: true, data });
  }
}
