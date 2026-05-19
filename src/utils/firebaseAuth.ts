import crypto from "crypto";
import { AppError } from "./AppError";

type FirebaseCerts = Record<string, string>;

type FirebaseTokenPayload = {
  aud: string;
  email?: string;
  email_verified?: boolean;
  exp: number;
  iat: number;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
  user_id?: string;
  firebase?: {
    sign_in_provider?: string;
  };
};

let cachedCerts: FirebaseCerts | null = null;
let cachedUntil = 0;

const base64UrlToBuffer = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
};

const parseJsonPart = <T>(value: string): T => {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
};

const getFirebaseProjectId = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new AppError("Firebase Auth is not configured", 503);
  }
  return projectId;
};

const getFirebaseCerts = async () => {
  const now = Date.now();
  if (cachedCerts && cachedUntil > now) {
    return cachedCerts;
  }

  const response = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );

  if (!response.ok) {
    throw new AppError("Unable to load Firebase certificates", 503);
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = (await response.json()) as FirebaseCerts;
  cachedUntil = now + maxAgeSeconds * 1000;

  return cachedCerts;
};

export const verifyFirebaseIdToken = async (idToken: string) => {
  const projectId = getFirebaseProjectId();
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new AppError("Invalid Firebase token", 401);
  }

  const header = parseJsonPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = parseJsonPart<FirebaseTokenPayload>(parts[1]);

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppError("Invalid Firebase token header", 401);
  }

  const certs = await getFirebaseCerts();
  const certificate = certs[header.kid];
  if (!certificate) {
    throw new AppError("Unknown Firebase token certificate", 401);
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const signatureIsValid = verifier.verify(certificate, base64UrlToBuffer(parts[2]));
  if (!signatureIsValid) {
    throw new AppError("Invalid Firebase token signature", 401);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds || payload.iat > nowSeconds) {
    throw new AppError("Expired Firebase token", 401);
  }

  if (payload.aud !== projectId) {
    throw new AppError("Invalid Firebase token audience", 401);
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AppError("Invalid Firebase token issuer", 401);
  }

  if (!payload.sub || !payload.email) {
    throw new AppError("Firebase token missing user email", 401);
  }

  return {
    uid: payload.user_id || payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || payload.email.split("@")[0],
    provider: payload.firebase?.sign_in_provider || "firebase",
  };
};
