import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: "admin" | "evaluator";
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required",
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, secret) as AuthUser;

    if (!decoded.userId || !decoded.tenantId || !decoded.role) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };

    next();
  } catch {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Invalid authentication token",
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  }
};