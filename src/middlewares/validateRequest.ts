import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const validateRequest =
  (schema: z.ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    }) as { body?: unknown; params?: any; query?: any };

    req.body = parsed.body ?? req.body;
    req.params = parsed.params ?? req.params;

    return next();
  };
