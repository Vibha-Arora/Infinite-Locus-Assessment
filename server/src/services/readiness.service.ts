import pool from "../db/postgres/pool.js";
import type { PoolClient } from "pg";

const REQUIRED_COMPETENCIES = [
  "frontend",
  "backend",
  "databases",
  "problem solving",
] as const;

export type ReadinessStatus =
  | "INCOMPLETE"
  | "READY"
  | "NEARLY_READY"
  | "DEVELOPING"
  | "NEEDS_PREPARATION";

export interface CompetencyReadiness {
  competency: string;
  weight: number;
  score: number | null;
  attemptId: string | null;
  submittedAt: string | null;
}

export interface ReadinessResult {
  overallScore: number | null;
  status: ReadinessStatus;
  competencies: CompetencyReadiness[];
}

export const calculateReadiness = async (
  tenantId: string,
  studentId: string,
  db: PoolClient | typeof pool = pool
): Promise<ReadinessResult> => {
  const result = await db.query(
    `
    SELECT
      c.name AS competency,
      c.weight,
      a.id AS attempt_id,
      a.score,
      a.submitted_at
    FROM competencies c
    LEFT JOIN LATERAL (
      SELECT
        id,
        score,
        submitted_at
      FROM attempts
      WHERE
        tenant_id = $1
        AND student_id = $2
        AND competency_id = c.id
        AND is_void = false
      ORDER BY submitted_at DESC, id DESC
      LIMIT 1
    ) a ON true
    WHERE c.name = ANY($3::text[])
    ORDER BY c.name;
    `,
    [tenantId, studentId, REQUIRED_COMPETENCIES]
  );

  const competencies: CompetencyReadiness[] = result.rows.map((row) => ({
    competency: row.competency,
    weight: Number(row.weight),
    score: row.score === null ? null : Number(row.score),
    attemptId: row.attempt_id,
    submittedAt: row.submitted_at,
  }));

  // All four required competencies must have
  // a valid non-voided attempt.
  const hasMissingCompetency =
    competencies.length !== REQUIRED_COMPETENCIES.length ||
    competencies.some((item) => item.score === null);

  if (hasMissingCompetency) {
    return {
      overallScore: null,
      status: "INCOMPLETE",
      competencies,
    };
  }

  // Weighted mean:
  // frontend = 30%
  // backend = 30%
  // databases = 25%
  // problem solving = 15%
  const overallScore = competencies.reduce((total, item) => {
    return total + (item.score ?? 0) * item.weight;
  }, 0);

  let status: ReadinessStatus;

  if (overallScore >= 80) {
    status = "READY";
  } else if (overallScore >= 65) {
    status = "NEARLY_READY";
  } else if (overallScore >= 50) {
    status = "DEVELOPING";
  } else {
    status = "NEEDS_PREPARATION";
  }

  return {
    overallScore: Number(overallScore.toFixed(2)),
    status,
    competencies,
  };
};