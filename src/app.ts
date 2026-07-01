import express, { Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import { router } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const getCorsOptions = (): CorsOptions => {
  const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "";
  const configuredOrigins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = [
    ...new Set([
      ...configuredOrigins,
      "https://localhost",
      "capacitor://localhost",
    ]),
  ];

  if (configuredOrigins.length === 0 || configuredOrigins.includes("*")) {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  };
};

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors(getCorsOptions()));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "PayTranche API",
      version: "1.0.0",
      health: "/api/health",
    });
  });

  app.use("/api", router);

  app.use(errorHandler);

  return app;
};
