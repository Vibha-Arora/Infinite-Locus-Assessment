import { Router } from "express";

import {
  getStudentsHandler,
  getStudentByIdHandler,
  updateStudentHandler,
} from "../controllers/students.controller.js";

import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/students",
  requireAuth,
  getStudentsHandler
);

router.get(
  "/students/:id",
  requireAuth,
  getStudentByIdHandler
);

router.patch(
  "/students/:id",
  requireAuth,
  updateStudentHandler
);

export default router;