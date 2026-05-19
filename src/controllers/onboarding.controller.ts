import { Request, Response } from "express";
import { OnboardingService } from "../services/onboarding.service";

const onboardingService = new OnboardingService();

export class OnboardingController {
  async status(req: Request, res: Response) {
    const data = await onboardingService.getStatus(req.tenantId!, req.user!.id);
    return res.json({ success: true, data });
  }

  async complete(req: Request, res: Response) {
    const data = await onboardingService.complete(
      req.tenantId!,
      req.user!.id,
      req.body
    );
    return res.json({ success: true, data });
  }
}
