import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";

import {
  getStudentActivity,
} from "../services/activity.service.js";

export const getStudentActivityHandler = async (
  req: AuthRequest,
  res: Response
) => {
  const requestId =
    typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : "unknown";

  try {
    if (!req.user) {
      return res.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        requestId,
      });
    }

    const studentId = String(req.params.id);

    const page =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : 1;

    const limit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : 20;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid page or limit",
        requestId,
      });
    }

    const activity = await getStudentActivity({
      tenantId: req.user.tenantId,
      studentId,
      page,
      limit,
    });

    return res.status(200).json({
      code: "ACTIVITY_FETCHED",
      data: activity,
      requestId,
    });
  } catch (error) {
    console.error("Get student activity error:", error);

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch student activity",
      requestId,
    });
  }
};