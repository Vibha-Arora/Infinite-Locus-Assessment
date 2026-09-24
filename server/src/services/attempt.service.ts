import type { PoolClient } from "pg";
import pool from "../db/postgres/pool.js";

import {
  calculateReadiness,
  type ReadinessResult,
} from "./readiness.service.js";

import {
  getIdempotencyRecord,
  saveIdempotencyRecord,
} from "./idempotency.service.js";

export interface CreateAttemptInput {
  tenantId: string;
  studentId: string;
  competencyId: string;
  score: number;
  evaluatorId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  requestId: string;
}

export interface CreateAttemptResult {
  attemptId: string;
  readiness: ReadinessResult;
  responseBody: Record<string, unknown>;
  replayed: boolean;
  statusCode: number;
}

export const createAttempt = async (
  input: CreateAttemptInput
): Promise<CreateAttemptResult> => {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // ==========================================
    // 1. IDEMPOTENCY CHECK
    // ==========================================

    const existingRecord = await getIdempotencyRecord(
      input.tenantId,
      input.idempotencyKey,
      client
    );

    if (existingRecord) {
      if (
        existingRecord.request_fingerprint !==
        input.requestFingerprint
      ) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }

      const responseBody =
        existingRecord.response_body as Record<string, unknown>;

      await client.query("COMMIT");

      let readiness: ReadinessResult = {
        overallScore: null,
        status: "INCOMPLETE",
        competencies: [],
      };

      if (
        responseBody.data &&
        typeof responseBody.data === "object" &&
        "readiness" in responseBody.data
      ) {
        const data = responseBody.data as {
          readiness?: ReadinessResult;
        };

        if (data.readiness) {
          readiness = data.readiness;
        }
      }

      return {
        attemptId: existingRecord.attempt_id ?? "",
        readiness,
        responseBody,
        replayed: true,
        statusCode: existingRecord.status_code,
      };
    }

    // ==========================================
    // 2. VALIDATE SCORE
    // ==========================================

    if (
      !Number.isFinite(input.score) ||
      input.score < 0 ||
      input.score > 100
    ) {
      throw new Error("INVALID_SCORE");
    }

    // ==========================================
    // 3. CHECK STUDENT
    // ==========================================

    const studentResult = await client.query<{
      id: string;
      version: number;
    }>(
      `
      SELECT
        id,
        version
      FROM students
      WHERE id = $1
        AND tenant_id = $2
      FOR UPDATE
      `,
      [input.studentId, input.tenantId]
    );

    if (studentResult.rowCount === 0) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    // ==========================================
    // 4. CHECK COMPETENCY
    // ==========================================

    const competencyResult = await client.query<{
      id: string;
      name: string;
      weight: number;
    }>(
      `
      SELECT
        id,
        name,
        weight
      FROM competencies
      WHERE id = $1
      `,
      [input.competencyId]
    );

    if (competencyResult.rowCount === 0) {
      throw new Error("COMPETENCY_NOT_FOUND");
    }

    // ==========================================
    // 5. CREATE ATTEMPT
    // ==========================================

    const attemptResult = await client.query<{
      id: string;
      submitted_at: string;
    }>(
      `
      INSERT INTO attempts (
        tenant_id,
        student_id,
        competency_id,
        score,
        evaluator_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        submitted_at
      `,
      [
        input.tenantId,
        input.studentId,
        input.competencyId,
        input.score,
        input.evaluatorId,
      ]
    );

    const attempt = attemptResult.rows[0];

    if (!attempt) {
      throw new Error("ATTEMPT_CREATION_FAILED");
    }

    // ==========================================
    // 6. CALCULATE READINESS
    // ==========================================

    const readiness = await calculateReadiness(
      input.tenantId,
      input.studentId,
      client
    );

    // ==========================================
    // 7. UPDATE STUDENT CURRENT SCORE
    // ==========================================

    const currentScore = readiness.overallScore ?? 0;

    await client.query(
      `
      UPDATE students
      SET
        current_score = $1,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $2
        AND tenant_id = $3
      `,
      [
        currentScore,
        input.studentId,
        input.tenantId,
      ]
    );

    // ==========================================
    // 8. PREPARE RESPONSE
    // ==========================================

    const responseBody: Record<string, unknown> = {
      code: "ATTEMPT_CREATED",

      data: {
        attemptId: attempt.id,
        readiness,
      },

      requestId: input.requestId,
    };

    // ==========================================
    // 9. SAVE IDEMPOTENCY RECORD
    // ==========================================

    await saveIdempotencyRecord({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      statusCode: 201,
      responseBody,
      attemptId: attempt.id,
      db: client,
    });

    // ==========================================
    // 10. COMMIT TRANSACTION
    // ==========================================

    await client.query("COMMIT");

    // ==========================================
    // 11. RETURN RESULT
    // ==========================================

    return {
      attemptId: attempt.id,
      readiness,
      responseBody,
      replayed: false,
      statusCode: 201,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
};