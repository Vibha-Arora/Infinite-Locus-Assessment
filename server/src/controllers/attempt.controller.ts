import crypto from "crypto";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";

import { createActivityEvent } from "../services/activity.service.js";
import { createAttempt } from "../services/attempt.service.js";

import {
  createRequestFingerprint,
  getIdempotencyRecord,
} from "../services/idempotency.service.js";

export const createStudentAttempt = async (
  req: AuthRequest,
  res: Response
) => {
  const requestId =
    typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : crypto.randomUUID();

  try {
    // ==========================================
    // 1. AUTHENTICATION
    // ==========================================

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        requestId,
      });
    }

    // ==========================================
    // 2. STUDENT ID
    // ==========================================

    const studentId = String(req.params.id);

    // ==========================================
    // 3. IDEMPOTENCY KEY
    // ==========================================

    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey || Array.isArray(idempotencyKey)) {
      return res.status(400).json({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Idempotency-Key header is required",
        requestId,
      });
    }

    if (
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 255
    ) {
      return res.status(400).json({
        code: "INVALID_IDEMPOTENCY_KEY",
        message:
          "Idempotency-Key must contain 8 to 255 characters",
        requestId,
      });
    }

    // ==========================================
    // 4. REQUEST BODY
    // ==========================================

    const { competencyId, score } = req.body;

    const fieldErrors: Record<string, string> = {};

    if (
      typeof competencyId !== "string" ||
      competencyId.trim().length === 0
    ) {
      fieldErrors.competencyId =
        "Competency ID is required";
    }

    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      fieldErrors.score =
        "Score must be a number between 0 and 100";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        fields: fieldErrors,
        requestId,
      });
    }

    // ==========================================
    // 5. REQUEST FINGERPRINT
    // ==========================================

    const requestFingerprint = createRequestFingerprint({
      competencyId,
      score,
    });

    // ==========================================
    // 6. QUICK IDEMPOTENCY CHECK
    // ==========================================

    const existingRecord = await getIdempotencyRecord(
      user.tenantId,
      idempotencyKey
    );

    if (existingRecord) {
      // Same key + different body
      if (
        existingRecord.request_fingerprint !==
        requestFingerprint
      ) {
        return res.status(409).json({
          code: "IDEMPOTENCY_KEY_REUSED",
          message:
            "Idempotency-Key has already been used with a different request body",
          requestId,
        });
      }

      // Same key + same body
      const replayBody =
        existingRecord.response_body as Record<
          string,
          unknown
        >;

      return res
        .status(existingRecord.status_code)
        .json({
          ...replayBody,
          requestId,
        });
    }

    // ==========================================
    // 7. CREATE ATTEMPT
    // ==========================================

    const result = await createAttempt({
  tenantId: user.tenantId,
  studentId,
  competencyId,
  score,
  evaluatorId: user.userId,
  idempotencyKey,
  requestFingerprint,
  requestId,
});

    // ==========================================
    // 8. CREATE MONGODB SUCCESS EVENT
    // ==========================================

    try {
      await createActivityEvent({
        eventType: "attempt.succeeded",
        tenantId: user.tenantId,
        studentId,
        attemptId: result.attemptId,
        requestId,
        metadata: {
          score,
          competencyId,
        },
      });
    } catch (eventError) {
      console.error(
        "Failed to create MongoDB activity event:",
        eventError
      );

      /*
       * PostgreSQL attempt has already committed.
       *
       * We don't expose MongoDB error details to the client.
       * The successful relational operation remains available.
       */
    }

    // ==========================================
    // 9. RETURN RESPONSE
    // ==========================================

    return res
      .status(result.statusCode ?? 201)
      .json({
        ...result.responseBody,
        requestId,
      });
  } catch (error) {
    console.error("Create attempt error:", error);

    // ==========================================
    // 10. KNOWN BUSINESS ERRORS
    // ==========================================

    if (error instanceof Error) {
      if (error.message === "INVALID_SCORE") {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Score must be between 0 and 100",
          requestId,
        });
      }

      if (error.message === "STUDENT_NOT_FOUND") {
        return res.status(404).json({
          code: "STUDENT_NOT_FOUND",
          message: "Student not found",
          requestId,
        });
      }

      if (error.message === "COMPETENCY_NOT_FOUND") {
        return res.status(400).json({
          code: "COMPETENCY_NOT_FOUND",
          message: "Invalid competency",
          requestId,
        });
      }

      if (error.message === "IDEMPOTENCY_KEY_REUSED") {
        return res.status(409).json({
          code: "IDEMPOTENCY_KEY_REUSED",
          message:
            "Idempotency-Key has already been used with a different request body",
          requestId,
        });
      }
    }

    // ==========================================
    // 11. INTERNAL ERROR
    // ==========================================

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to create attempt",
      requestId,
    });
  }
};