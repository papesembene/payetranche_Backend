import { prisma } from "../utils/prisma";
import { signJwt } from "../utils/jwt";
import { hashPassword } from "../utils/password";
import { SocialLoginInput } from "../schemas/auth.schema";
import { verifyFirebaseIdToken } from "../utils/firebaseAuth";
import { verifyGoogleIdToken } from "../utils/googleAuth";
import { emailService } from "./email.service";
import crypto from "crypto";

export class AuthService {
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
