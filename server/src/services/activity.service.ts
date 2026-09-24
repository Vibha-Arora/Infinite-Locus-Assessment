import crypto from "crypto";
import { ActivityEvent } from "../models/activity-event.model.js";

export type ActivityEventType =
  | "attempt.succeeded"
  | "attempt.rejected";

interface CreateActivityEventInput {
  eventType: ActivityEventType;
  tenantId: string;
  studentId?: string;
  attemptId?: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

export const createActivityEvent = async ({
  eventType,
  tenantId,
  studentId,
  attemptId,
  requestId,
  metadata = {},
}: CreateActivityEventInput) => {
  const eventId = crypto.randomUUID();

  try {
    return await ActivityEvent.create({
      eventId,
      eventType,
      tenantId,
      studentId,
      attemptId,
      requestId,
      occurredAt: new Date(),
      metadata,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return ActivityEvent.findOne({ eventId });
    }

    throw error;
  }
};

export const getStudentActivity = async ({
  tenantId,
  studentId,
  page,
  limit,
}: {
  tenantId: string;
  studentId: string;
  page: number;
  limit: number;
}) => {
  const skip = (page - 1) * limit;

  const filter = {
    tenantId,
    studentId,
  };

  const [items, total] = await Promise.all([
    ActivityEvent.find(filter)
      .sort({
        occurredAt: -1,
        eventId: -1,
      })
      .skip(skip)
      .limit(limit)
      .select({
        _id: 0,
        eventId: 1,
        eventType: 1,
        tenantId: 1,
        studentId: 1,
        attemptId: 1,
        requestId: 1,
        occurredAt: 1,
        metadata: 1,
      })
      .lean(),

    ActivityEvent.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};