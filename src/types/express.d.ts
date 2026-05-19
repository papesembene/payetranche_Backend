declare namespace Express {
  export interface AuthUser {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    phone?: string | null;
    plan: "GRATUIT" | "PRO" | "ENTREPRISE";
    planExpiresAt?: Date | null;
    role: "OWNER" | "ADMIN" | "STAFF";
  }

  export interface Request {
    tenantId?: string;
    user?: AuthUser;
  }
}
