import { Request, Response } from "express";
import { loginUser } from "../services/auth.service.js";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, tenantId } = req.body;

    if (!email || !password || !tenantId) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Email, password and tenantId are required",
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    const result = await loginUser({
      email,
      password,
      tenantId,
    });

    return res.status(200).json({
      code: "LOGIN_SUCCESS",
      message: "Login successful",
      data: result,
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed";

    if (
      message === "Invalid email or password" ||
      message === "User account is blocked"
    ) {
      return res.status(401).json({
        code: "AUTHENTICATION_FAILED",
        message,
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    console.error("Login error:", error);

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  }
};