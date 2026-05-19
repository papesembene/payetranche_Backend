import { Request, Response } from "express";
import { PayoutService } from "../services/payout.service";

const payoutService = new PayoutService();

export class PayoutController {
  getProfile = async (req: Request, res: Response) => {
    const profile = await payoutService.getProfile(req.tenantId!);
    return res.json({ success: true, data: profile });
  };

  upsertProfile = async (req: Request, res: Response) => {
    const profile = await payoutService.upsertProfile(req.tenantId!, req.body);
    return res.json({ success: true, data: profile });
  };

  getWallet = async (req: Request, res: Response) => {
    const wallet = await payoutService.getWallet(req.tenantId!);
    return res.json({ success: true, data: wallet });
  };

  listPayouts = async (req: Request, res: Response) => {
    const payouts = await payoutService.listPayouts(req.tenantId!, {
      status: req.query.status as any,
    });
    return res.json({ success: true, data: payouts });
  };

  initiateTransfer = async (req: Request, res: Response) => {
    const payout = await payoutService.initiatePayoutTransfer(
      req.tenantId!,
      req.params.id
    );
    return res.json({ success: true, data: payout });
  };

  syncTransfer = async (req: Request, res: Response) => {
    const payout = await payoutService.syncPayoutTransferStatus(
      req.tenantId!,
      req.params.id
    );
    return res.json({ success: true, data: payout });
  };
}
