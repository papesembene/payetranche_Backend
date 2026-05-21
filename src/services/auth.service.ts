import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { signJwt } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  LoginInput,
  RegisterInput,
  SocialLoginInput,
} from "../schemas/auth.schema";
import { verifyFirebaseIdToken } from "../utils/firebaseAuth";
import { verifyGoogleIdToken } from "../utils/googleAuth";
import { emailService } from "./email.service";
import crypto from "crypto";

type TikTokTokenResponse = {
  access_token?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
};

type TikTokUserInfoResponse = {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export class AuthService {
  async register(input: RegisterInput) {
    const passwordHash = hashPassword(input.password);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.companyName },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash,
        },
      });

      return { tenant, user };
    });

    const token = signJwt({
      sub: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      name: result.user.name,
    });

    void emailService.sendWelcomeEmail({
      to: result.user.email,
      name: result.user.name,
    });

    return {
      token,
      tenant: result.tenant,
      user: this.toSafeUser(result.user, false),
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = signJwt({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    });

    const onboardingCompleted = await this.isOnboardingComplete(
      user.tenantId,
      user.phone,
    );

    return {
      token,
      user: this.toSafeUser(user, onboardingCompleted),
    };
  }

  async socialLogin(input: SocialLoginInput) {
    const socialUser =
      input.provider === "google"
        ? await verifyGoogleIdToken(input.idToken)
        : await verifyFirebaseIdToken(input.idToken);

    let user = await prisma.user.findUnique({
      where: { email: socialUser.email },
    });

    let createdAccount = false;
    let tenant = user
      ? await prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } })
      : null;

    if (!user) {
      createdAccount = true;
      const result = await prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            name:
              input.companyName ||
              socialUser.name ||
              socialUser.email.split("@")[0],
          },
        });

        const createdUser = await tx.user.create({
          data: {
            tenantId: createdTenant.id,
            name: socialUser.name,
            email: socialUser.email,
            passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
          },
        });

        return { tenant: createdTenant, user: createdUser };
      });

      tenant = result.tenant;
      user = result.user;
    }

    if (createdAccount) {
      void emailService.sendWelcomeEmail({
        to: user.email,
        name: user.name,
      });
    }

    const onboardingCompleted = await this.isOnboardingComplete(
      user.tenantId,
      user.phone,
    );

    const token = signJwt({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      tenant,
      user: this.toSafeUser(user, onboardingCompleted),
    };
  }

  getTikTokAuthorizationUrl(input: { companyName?: string }) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      throw new AppError("TikTok login is not configured", 503);
    }

    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("scope", "user.info.basic");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.getTikTokRedirectUri());
    url.searchParams.set(
      "state",
      this.signTikTokState({
        companyName: input.companyName,
        nonce: crypto.randomBytes(16).toString("hex"),
      }),
    );

    return url.toString();
  }

  async completeTikTokLogin(query: Record<string, unknown>) {
    const error = this.getQueryValue(query.error);
    if (error) {
      throw new AppError(`TikTok login cancelled: ${error}`, 401);
    }

    const code = this.getQueryValue(query.code);
    const state = this.getQueryValue(query.state);
    if (!code || !state) {
      throw new AppError("TikTok login response is incomplete", 400);
    }

    const statePayload = this.verifyTikTokState(state);
    const tokenData = await this.exchangeTikTokCode(code);
    const profile = await this.getTikTokProfile(tokenData.access_token!);
    const openId = profile.open_id || tokenData.open_id;

    if (!openId) {
      throw new AppError("TikTok did not return a user id", 401);
    }

    const email = `tiktok-${openId}@auth.paytranche.local`;
    const displayName = profile.display_name || "Utilisateur TikTok";

    let user = await prisma.user.findUnique({ where: { email } });
    let tenant = user
      ? await prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } })
      : null;

    if (!user) {
      const result = await prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            name: statePayload.companyName || displayName,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            tenantId: createdTenant.id,
            name: displayName,
            email,
            passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
          },
        });

        return { tenant: createdTenant, user: createdUser };
      });

      tenant = result.tenant;
      user = result.user;
    }

    const onboardingCompleted = await this.isOnboardingComplete(
      user.tenantId,
      user.phone,
    );

    const token = signJwt({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      tenant,
      user: this.toSafeUser(user, onboardingCompleted),
    };
  }

  private async isOnboardingComplete(
    tenantId: string,
    userPhone?: string | null,
  ) {
    if (!userPhone?.trim()) {
      return false;
    }

    const payoutProfileCount = await prisma.sellerPayoutProfile.count({
      where: { tenantId },
    });

    return payoutProfileCount > 0;
  }

  private getQueryValue(value: unknown) {
    if (Array.isArray(value)) {
      return typeof value[0] === "string" ? value[0] : "";
    }
    return typeof value === "string" ? value : "";
  }

  private getTikTokRedirectUri() {
    if (process.env.TIKTOK_REDIRECT_URI) {
      return process.env.TIKTOK_REDIRECT_URI;
    }

    const publicUrl = (process.env.PUBLIC_API_URL || process.env.APP_URL || "").replace(/\/$/, "");
    if (!publicUrl) {
      throw new AppError("PUBLIC_API_URL must be configured for TikTok login", 503);
    }

    return `${publicUrl}/api/auth/tiktok/callback`;
  }

  private signTikTokState(payload: { nonce: string; companyName?: string }) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", process.env.JWT_SECRET || "paytranche")
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private verifyTikTokState(state: string) {
    const [encodedPayload, signature] = state.split(".");
    if (!encodedPayload || !signature) {
      throw new AppError("Invalid TikTok state", 401);
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.JWT_SECRET || "paytranche")
      .update(encodedPayload)
      .digest("base64url");

    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new AppError("Invalid TikTok state", 401);
    }

    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      nonce: string;
      companyName?: string;
    };
  }

  private async exchangeTikTokCode(code: string) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
      throw new AppError("TikTok login is not configured", 503);
    }

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.getTikTokRedirectUri(),
    });

    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await response.json()) as TikTokTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new AppError(data.error_description || data.error || "TikTok token exchange failed", 401);
    }

    return data;
  }

  private async getTikTokProfile(accessToken: string) {
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const data = (await response.json()) as TikTokUserInfoResponse;

    if (!response.ok) {
      throw new AppError(data.error?.message || "Unable to load TikTok profile", 401);
    }

    return data.data?.user || {};
  }

  private toSafeUser(
    user: {
      id: string;
      tenantId: string;
      email: string;
      name: string;
      phone?: string | null;
      plan: "GRATUIT" | "PRO" | "ENTREPRISE";
      planExpiresAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
      role: "OWNER" | "ADMIN" | "STAFF";
    },
    onboardingCompleted: boolean,
  ) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      onboardingCompleted,
    };
  }
}
