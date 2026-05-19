import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { OnboardingService } from "../services/onboarding.service";

const authService = new AuthService();
const onboardingService = new OnboardingService();

export class AuthController {
  async register(req: Request, res: Response) {
    const data = await authService.register(req.body);
    return res.status(201).json({ success: true, data });
  }

  async login(req: Request, res: Response) {
    const data = await authService.login(req.body);
    return res.json({ success: true, data });
  }

  async socialLogin(req: Request, res: Response) {
    const data = await authService.socialLogin(req.body);
    return res.json({ success: true, data });
  }

  async me(req: Request, res: Response) {
    const onboarding = await onboardingService.getStatus(req.tenantId!, req.user!.id);

    return res.json({
      success: true,
      data: {
        user: onboarding.user,
        tenant: onboarding.tenant,
        onboarding,
        tenantId: req.tenantId,
      },
    });
  }
}
