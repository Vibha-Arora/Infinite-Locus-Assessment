import "dotenv/config";
import mongoose from "mongoose";
import { ActivityEvent } from "../models/activity-event.model.js";

const runReport = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    console.log("MongoDB connected");

    // ==========================================
    // 1. DUPLICATE SUCCESS EVENTS
    // ==========================================

    const duplicateSuccessEvents =
      await ActivityEvent.aggregate([
        {
          $match: {
            eventType: "attempt.succeeded",
            attemptId: {
              $exists: true,
              $ne: null,
            },
          },
        },
        {
          $group: {
            _id: {
              tenantId: "$tenantId",
              attemptId: "$attemptId",
            },
            count: {
              $sum: 1,
            },
            eventIds: {
              $push: "$eventId",
            },
          },
        },
        {
          $match: {
            count: {
              $gt: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            tenantId: "$_id.tenantId",
            attemptId: "$_id.attemptId",
            duplicateCount: "$count",
            eventIds: 1,
          },
        },
      ]);

    // ==========================================
    // 2. REJECTION RATE BY TENANT
    // ==========================================

    const rejectionRateByTenant =
      await ActivityEvent.aggregate([
        {
          $group: {
            _id: "$tenantId",
            totalEvents: {
              $sum: 1,
            },
            rejectedEvents: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$eventType",
                      "attempt.rejected",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            tenantId: "$_id",
            totalEvents: 1,
            rejectedEvents: 1,
            rejectionRate: {
              $cond: [
                {
                  $eq: ["$totalEvents", 0],
                },
                0,
                {
                  $multiply: [
                    {
                      $divide: [
                        "$rejectedEvents",
                        "$totalEvents",
                      ],
                    },
                    100,
                  ],
                },
              ],
            },
          },
        },
        {
          $sort: {
            rejectionRate: -1,
          },
        },
      ]);

    console.log("\n=== DUPLICATE SUCCESS EVENTS ===");

    console.dir(duplicateSuccessEvents, {
      depth: null,
    });

    console.log("\n=== REJECTION RATE BY TENANT ===");

    console.dir(rejectionRateByTenant, {
      depth: null,
    });
  } catch (error) {
    console.error("Activity report failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runReport();