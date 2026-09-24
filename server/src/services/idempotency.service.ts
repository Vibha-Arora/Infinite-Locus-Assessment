import crypto from "crypto";
import type { PoolClient } from "pg";
import pool from "../db/postgres/pool.js";

export interface IdempotencyRecord {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  status_code: number;
  response_body: unknown;
  attempt_id: string | null;
  created_at: string;
  expires_at: string;
}

type Database = PoolClient | typeof pool;

export const createRequestFingerprint = (
  body: unknown
): string => {
  const normalizedBody = JSON.stringify(body);

  return crypto
    .createHash("sha256")
    .update(normalizedBody)
    .digest("hex");
};

export const getIdempotencyRecord = async (
  tenantId: string,
  idempotencyKey: string,
  db: Database = pool
): Promise<IdempotencyRecord | null> => {
  const result = await db.query<IdempotencyRecord>(
    `
    SELECT
      id,
      tenant_id,
      idempotency_key,
      request_fingerprint,
      status_code,
      response_body,
      attempt_id,
      created_at,
      expires_at
    FROM idempotency_records
    WHERE tenant_id = $1
      AND idempotency_key = $2
      AND expires_at > NOW()
    LIMIT 1
    `,
    [tenantId, idempotencyKey]
  );

  return result.rows[0] ?? null;
};

export const saveIdempotencyRecord = async ({
  tenantId,
  idempotencyKey,
  requestFingerprint,
  statusCode,
  responseBody,
  attemptId,
  db = pool,
}: {
  tenantId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  statusCode: number;
  responseBody: unknown;
  attemptId?: string | null;
  db?: Database;
}): Promise<IdempotencyRecord> => {
  const result = await db.query<IdempotencyRecord>(
    `
    INSERT INTO idempotency_records (
      tenant_id,
      idempotency_key,
      request_fingerprint,
      status_code,
      response_body,
      attempt_id,
      created_at,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      $6,
      NOW(),
      NOW() + INTERVAL '24 hours'
    )
    RETURNING
      id,
      tenant_id,
      idempotency_key,
      request_fingerprint,
      status_code,
      response_body,
      attempt_id,
      created_at,
      expires_at
    `,
    [
      tenantId,
      idempotencyKey,
      requestFingerprint,
      statusCode,
      JSON.stringify(responseBody),
      attemptId ?? null,
    ]
  );

  return result.rows[0];
};