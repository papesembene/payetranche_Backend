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

  async startTikTokLogin(req: Request, res: Response) {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

    try {
      const redirectUrl = authService.getTikTokAuthorizationUrl({
        companyName: typeof req.query.companyName === "string" ? req.query.companyName : undefined,
      });

      return res.redirect(redirectUrl);
    } catch (error) {
      const message = encodeURIComponent(
        error instanceof Error ? error.message : "Connexion TikTok impossible",
      );
      return res.redirect(`${frontendUrl}/auth/callback#error=${message}`);
    }
  }

  async completeTikTokLogin(req: Request, res: Response) {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

    try {
      const data = await authService.completeTikTokLogin(req.query);
      const session = Buffer.from(JSON.stringify({ token: data.token })).toString("base64url");

      return res.redirect(`${frontendUrl}/auth/callback#session=${session}`);
    } catch (error) {
      const message = encodeURIComponent(
        error instanceof Error ? error.message : "Connexion TikTok impossible",
      );
      return res.redirect(`${frontendUrl}/auth/callback#error=${message}`);
    }
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
