// import pool from "./db/postgres/pool.js";

// const PORT = process.env.PORT || 5000;

// async function startServer() {
//   try {
//     await pool.query("SELECT NOW()");

//     console.log("Database connection successful");

//     console.log(`Server running on port ${PORT}`);
//   } catch (error) {
//     console.error("Database connection failed:", error);
//     process.exit(1);
//   }
// }

// startServer();
import {
  getStudentsHandler,
  getStudentByIdHandler,
} from "./controllers/students.controller.js";
import studentRoutes from "./routes/students.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import { requireAuth } from "./middleware/auth.js";
import "dotenv/config";

import express from "express";
import authRoutes from "./routes/auth.routes.js";
import { connectMongo } from "./config/mongo.js";

const app = express();

app.use(express.json());
app.use("/api/auth", authRoutes);
app.get("/api/students", requireAuth, getStudentsHandler);
app.get(
  "/api/students/:id",
  requireAuth,
  getStudentByIdHandler
);
app.use("/api", attemptRoutes);
app.use("/api", studentRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();