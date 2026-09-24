import pool from "../db/postgres/pool.js";


interface GetStudentsParams {
  tenantId: string;
  search?: string;
  page: number;
  limit: number;
}

export const getStudents = async ({
  tenantId,
  search = "",
  page,
  limit,
}: GetStudentsParams) => {
  const offset = (page - 1) * limit;

  const searchPattern = `%${search}%`;

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM students
    WHERE tenant_id = $1
      AND (
        name ILIKE $2
        OR email ILIKE $2
      )
    `,
    [tenantId, searchPattern]
  );

  const total = countResult.rows[0].total;

  const result = await pool.query(
    `
    SELECT
      id,
      name,
      email,
      current_score,
      version,
      created_at,
      updated_at
    FROM students
    WHERE tenant_id = $1
      AND (
        name ILIKE $2
        OR email ILIKE $2
      )
    ORDER BY name ASC, id ASC
    LIMIT $3
    OFFSET $4
    `,
    [tenantId, searchPattern, limit, offset]
  );

  return {
    items: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getStudentById = async (
  tenantId: string,
  studentId: string
) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      email,
      current_score,
      version,
      created_at,
      updated_at
    FROM students
    WHERE tenant_id = $1
      AND id = $2
    `,
    [tenantId, studentId]
  );

  return result.rows[0] ?? null;
};

export const updateStudent = async ({
  tenantId,
  studentId,
  name,
  email,
  expectedVersion,
}: {
  tenantId: string;
  studentId: string;
  name?: string;
  email?: string;
  expectedVersion: number;
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<{
      id: string;
      name: string;
      email: string;
      version: number;
    }>(
      `
      SELECT
        id,
        name,
        email,
        version
      FROM students
      WHERE id = $1
        AND tenant_id = $2
      FOR UPDATE
      `,
      [studentId, tenantId]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        type: "NOT_FOUND" as const,
      };
    }

    const current = currentResult.rows[0];

    if (current.version !== expectedVersion) {
      await client.query("ROLLBACK");

      return {
        type: "STALE_VERSION" as const,
        currentVersion: current.version,
      };
    }

    const nextName = name ?? current.name;
    const nextEmail = email ?? current.email;

    const updateResult = await client.query(
      `
      UPDATE students
      SET
        name = $1,
        email = $2,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $3
        AND tenant_id = $4
        AND version = $5
      RETURNING
        id,
        tenant_id,
        name,
        email,
        current_score,
        version,
        created_at,
        updated_at
      `,
      [
        nextName,
        nextEmail,
        studentId,
        tenantId,
        expectedVersion,
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return {
        type: "STALE_VERSION" as const,
        currentVersion: current.version,
      };
    }

    await client.query("COMMIT");

    return {
      type: "SUCCESS" as const,
      student: updateResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};