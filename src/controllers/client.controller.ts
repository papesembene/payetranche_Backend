import { Request, Response } from "express";
import { ClientService } from "../services/client.service";

const clientService = new ClientService();

export class ClientController {
  async create(req: Request, res: Response) {
    const client = await clientService.create(req.tenantId as string, req.body);
    return res.status(201).json({ success: true, data: client });
  }

  async list(req: Request, res: Response) {
    const clients = await clientService.list(req.tenantId as string, req.query as any);
    return res.json({ success: true, data: clients });
  }

  async getById(req: Request, res: Response) {
    const client = await clientService.getById(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: client });
  }

  async update(req: Request, res: Response) {
    const client = await clientService.update(
      req.tenantId as string,
      req.params.id,
      req.body
    );
    return res.json({ success: true, data: client });
  }

  async delete(req: Request, res: Response) {
    const result = await clientService.delete(
      req.tenantId as string,
      req.params.id
    );
    return res.json({ success: true, data: result });
  }
}
