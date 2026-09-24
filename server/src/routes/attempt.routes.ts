import { Router } from "express";
import { createStudentAttempt } from "../controllers/attempt.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/students/:id/attempts",
  requireAuth,
  createStudentAttempt
);

export default router;