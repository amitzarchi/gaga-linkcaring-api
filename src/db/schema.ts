import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { sql } from "drizzle-orm";

export const milestoneCategories = pgEnum("milestone_categories", [
  "SOCIAL",
  "LANGUAGE",
  "FINE_MOTOR",
  "GROSS_MOTOR",
]);

// Policies table
export const policies = pgTable("policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Percentage of validators that must pass (0-100)
  minValidatorsPassed: integer("min_validators_passed").notNull(),
  // Minimum confidence threshold (0-100)
  minConfidence: integer("min_confidence").notNull(),
  // Whether this policy acts as the default when a milestone has no explicit policy
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const milestones = pgTable("milestones", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  category: milestoneCategories("category").notNull(), // e.g., 'SOCIAL', 'LANGUAGE', 'FINE_MOTOR', 'GROSS_MOTOR'
  policyId: integer("policy_id").references(() => policies.id, {
    onDelete: "set null",
  }),
});

export const validators = pgTable("validators", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  milestoneId: integer("milestone_id")
    .notNull()
    .references(() => milestones.id),
  description: text("description").notNull(),
});

export const milestoneAchievementRates = pgEnum("milestone_achievement_rates", [
  "GREEN",
  "YELLOW",
  "ORANGE",
  "RED",
]);

export type MilestoneAchievementRate =
  (typeof milestoneAchievementRates.enumValues)[number];

export const milestoneAgeStatuses = pgTable(
  "milestone_age_statuses",
  {
    milestoneId: integer("milestone_id")
      .notNull()
      .references(() => milestones.id),
    month: integer("month").notNull(), // Age in months
    achievementRate: milestoneAchievementRates("achievement_rate").notNull(),
  },
  (table) => [primaryKey({ columns: [table.milestoneId, table.month] })]
);

export const milestoneVideos = pgTable("milestone_videos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  milestoneId: integer("milestone_id")
    .notNull()
    .references(() => milestones.id),
  achievedMilestone: text("achieved_milestone").notNull(),
  videoPath: text("video_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull(),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const testResults = pgTable("test_results", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  milestoneId: integer("milestone_id")
    .notNull()
    .references(() => milestones.id, { onDelete: "cascade" }),
  videoId: integer("video_id")
    .notNull()
    .references(() => milestoneVideos.id, { onDelete: "cascade" }),
  success: boolean("success").notNull(),
  result: boolean("result").notNull(),
  confidence: integer("confidence"), // Store as integer percentage (0-100)
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System prompt change history (append-only). Latest row is the current prompt
export const systemPromptHistory = pgTable("system_prompt_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  content: text("content").notNull(),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => user.id),
});

// Models table - stores available inference models, with exactly one active at a time
export const models = pgTable(
  "models",
  {
    name: text("name").notNull(),
    model: text("model").primaryKey(),
    isActive: boolean("is_active").notNull().default(false),
    logoUrl: text("logo_url"),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("only_one_active_model")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  ]
);

export const responseStatus = pgEnum("response_status", ["SUCCESS", "ERROR"]);

export const responseStats = pgTable("response_stats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Auth
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, { onDelete: "set null"}),

  // Request context
  milestoneId: integer("milestone_id").references(() => milestones.id),
  systemPromptId: integer("system_prompt_id").references(() => systemPromptHistory.id),
  policyId: integer("policy_id").references(() => policies.id),

  // Model info
  model: text("model"),
  totalTokenCount: integer("total_token_count"),

  // Result summary
  status: responseStatus("status").notNull(),
  httpStatus: integer("http_status"),
  errorCode: text("error_code"),
  result: boolean("result"),
  confidence: integer("confidence"), // 0-100
  validatorsTotal: integer("validators_total"),
  validatorsPassed: integer("validators_passed"),
  processingMs: integer("processing_ms"),

  // Meta
  requestId: text("request_id"),
});