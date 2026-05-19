import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "./AppError";

type JwtPayload = {
  sub: string;
  tenantId: string;
  email: string;
  name: string;
  exp: number;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 24) {
    throw new AppError("JWT_SECRET must be configured", 500);
  }

  return secret;
}

function parseExpiresIn(value = process.env.JWT_EXPIRES_IN || "7d") {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    return 7 * 24 * 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[
    unit as "s" | "m" | "h" | "d"
  ];

  return amount * multiplier;
}

export function signJwt(payload: Omit<JwtPayload, "exp">) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + parseExpiresIn();
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify({ ...payload, exp }));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getJwtSecret()).update(data).digest();

  return `${data}.${base64Url(signature)}`;
}

export function verifyJwt(token: string): JwtPayload {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new AppError("Invalid token", 401);
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64Url(
    createHmac("sha256", getJwtSecret()).update(data).digest()
  );

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(encodedSignature);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new AppError("Invalid token", 401);
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as JwtPayload;

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AppError("Token expired", 401);
  }

  return payload;
}
