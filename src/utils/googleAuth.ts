import crypto from "crypto";
import { AppError } from "./AppError";

type GoogleJwk = {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
};

type GoogleJwks = {
  keys: GoogleJwk[];
};

type GoogleTokenPayload = {
  aud: string;
  email?: string;
  email_verified?: boolean | string;
  exp: number;
  iat: number;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
};

let cachedKeys: Record<string, GoogleJwk> | null = null;
let cachedUntil = 0;

const base64UrlToBuffer = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
};

const parseJsonPart = <T>(value: string): T => {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
};

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Google Auth is not configured", 503);
  }
  return clientId;
};

const getGoogleKeys = async () => {
  const now = Date.now();
  if (cachedKeys && cachedUntil > now) {
    return cachedKeys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new AppError("Unable to load Google certificates", 503);
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const jwks = (await response.json()) as GoogleJwks;

  cachedKeys = jwks.keys.reduce<Record<string, GoogleJwk>>((acc, key) => {
    acc[key.kid] = key;
    return acc;
  }, {});
  cachedUntil = now + maxAgeSeconds * 1000;

  return cachedKeys;
};

export const verifyGoogleIdToken = async (idToken: string) => {
  const clientId = getGoogleClientId();
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new AppError("Invalid Google token", 401);
  }

  const header = parseJsonPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = parseJsonPart<GoogleTokenPayload>(parts[1]);

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppError("Invalid Google token header", 401);
  }

  const keys = await getGoogleKeys();
  const jwk = keys[header.kid];
  if (!jwk) {
    throw new AppError("Unknown Google token certificate", 401);
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const signatureIsValid = verifier.verify(publicKey, base64UrlToBuffer(parts[2]));
  if (!signatureIsValid) {
    throw new AppError("Invalid Google token signature", 401);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds || payload.iat > nowSeconds) {
    throw new AppError("Expired Google token", 401);
  }

  if (payload.aud !== clientId) {
    throw new AppError("Invalid Google token audience", 401);
  }

  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
    throw new AppError("Invalid Google token issuer", 401);
  }

  if (!payload.sub || !payload.email) {
    throw new AppError("Google token missing user email", 401);
  }

  if (payload.email_verified === false || payload.email_verified === "false") {
    throw new AppError("Google email is not verified", 401);
  }

  return {
    uid: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name || payload.email.split("@")[0],
    provider: "google",
  };
};
