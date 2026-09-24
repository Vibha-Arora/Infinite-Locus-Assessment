import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/postgres/pool.js";

interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

export const loginUser = async ({
  email,
  password,
  tenantId,
}: LoginInput): Promise<LoginResult> => {
  // ==========================================
  // 1. VALIDATE INPUT
  // ==========================================

  if (!email || !password || !tenantId) {
    throw new Error("EMAIL_PASSWORD_TENANT_REQUIRED");
  }

  // ==========================================
  // 2. FIND USER
  // ==========================================

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    status: string;
  }>(
    `
    SELECT
      id,
      tenant_id,
      name,
      email,
      password_hash,
      role,
      status
    FROM users
    WHERE tenant_id = $1
      AND LOWER(email) = LOWER($2)
    LIMIT 1
    `,
    [tenantId, email.trim()]
  );

  // ==========================================
  // 3. USER NOT FOUND
  // ==========================================

  if (result.rows.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];

  // ==========================================
  // 4. CHECK ACCOUNT STATUS
  // ==========================================

  if (user.status !== "active") {
    throw new Error("USER_ACCOUNT_BLOCKED");
  }

  // ==========================================
  // 5. VERIFY PASSWORD
  // ==========================================

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // ==========================================
  // 6. JWT SECRET
  // ==========================================

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  // ==========================================
  // 7. CREATE JWT
  // ==========================================

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    },
    secret,
    {
      expiresIn: "1h",
    }
  );

  // ==========================================
  // 8. RETURN LOGIN RESULT
  // ==========================================

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    },
  };
};