import mongoose, { Schema, Document } from "mongoose";

export interface ActivityEventDocument extends Document {
  eventId: string;
  eventType: "attempt.succeeded" | "attempt.rejected";
  tenantId: string;
  studentId?: string;
  attemptId?: string;
  requestId: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

const activityEventSchema = new Schema<ActivityEventDocument>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: ["attempt.succeeded", "attempt.rejected"],
      index: true,
    },

    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    studentId: {
      type: String,
      index: true,
    },

    attemptId: {
      type: String,
      index: true,
    },

    requestId: {
      type: String,
      required: true,
      index: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    versionKey: false,
  }
);

activityEventSchema.index({
  tenantId: 1,
  studentId: 1,
  occurredAt: -1,
});

export const ActivityEvent = mongoose.model<ActivityEventDocument>(
  "ActivityEvent",
  activityEventSchema
);