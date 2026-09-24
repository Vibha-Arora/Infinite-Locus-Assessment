import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";

import {
  getStudents,
  getStudentById,
  updateStudent,
} from "../services/student.service.js";

import { calculateReadiness } from "../services/readiness.service.js";

export const getStudentsHandler = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    const search =
      typeof req.query.q === "string"
        ? req.query.q.trim()
        : "";

    const page =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : 1;

    const limit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : 10;

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
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    const students = await getStudents({
      tenantId: req.user.tenantId,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      code: "STUDENTS_FETCHED",
      data: students,
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch students",
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  }
};

export const getStudentByIdHandler = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    const studentId = String(req.params.id);

    const student = await getStudentById(
      req.user.tenantId,
      studentId
    );

    if (!student) {
      return res.status(404).json({
        code: "STUDENT_NOT_FOUND",
        message: "Student not found",
        requestId: req.headers["x-request-id"] ?? "unknown",
      });
    }

    const readiness = await calculateReadiness(
      req.user.tenantId,
      studentId
    );

    return res.status(200).json({
      code: "STUDENT_FETCHED",
      data: {
        student,
        readiness,
      },
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch student",
      requestId: req.headers["x-request-id"] ?? "unknown",
    });
  }
};

export const updateStudentHandler = async (
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

    const allowedFields = ["name", "email", "expectedVersion"];

    const invalidFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Unsupported fields in request",
        fields: {
          fields: `Unsupported fields: ${invalidFields.join(", ")}`,
        },
        requestId,
      });
    }

    const {
      name,
      email,
      expectedVersion,
    } = req.body;

    const fields: Record<string, string> = {};

    if (
      name !== undefined &&
      (typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 100)
    ) {
      fields.name = "Name must be a non-empty string";
    }

    if (
      email !== undefined &&
      (typeof email !== "string" ||
        email.trim().length === 0 ||
        email.length > 255)
    ) {
      fields.email = "Email must be a valid string";
    }

    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      fields.expectedVersion =
        "expectedVersion is required and must be a positive integer";
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        fields,
        requestId,
      });
    }

    if (name === undefined && email === undefined) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "At least one mutable field is required",
        requestId,
      });
    }

    const result = await updateStudent({
      tenantId: req.user.tenantId,
      studentId,
      name: name?.trim(),
      email: email?.trim(),
      expectedVersion,
    });

    if (result.type === "NOT_FOUND") {
      return res.status(404).json({
        code: "STUDENT_NOT_FOUND",
        message: "Student not found",
        requestId,
      });
    }

    if (result.type === "STALE_VERSION") {
      return res.status(409).json({
        code: "STALE_VERSION",
        message: "Student was modified by another request",
        currentVersion: result.currentVersion,
        requestId,
      });
    }

    return res.status(200).json({
      code: "STUDENT_UPDATED",
      data: {
        student: result.student,
      },
      requestId,
    });
  } catch (error) {
    console.error("Update student error:", error);

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to update student",
      requestId,
    });
  }
};