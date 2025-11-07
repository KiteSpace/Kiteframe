import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow snapshots for Version Control Pro
export const workflowSnapshots = pgTable("workflow_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  nodes: jsonb("nodes").notNull(),
  edges: jsonb("edges").notNull(),
  metadata: jsonb("metadata"),
  version: integer("version").notNull().default(1),
  isAutoSave: boolean("is_auto_save").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Collaboration rooms for real-time editing
export const collaborationRooms = pgTable("collaboration_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  isPrivate: boolean("is_private").default(false),
  maxParticipants: integer("max_participants").default(10),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Room participants
export const roomParticipants = pgTable("room_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").references(() => collaborationRooms.id),
  userId: varchar("user_id").references(() => users.id),
  role: varchar("role").notNull().default("member"), // owner, admin, member, viewer
  joinedAt: timestamp("joined_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

// Chat messages within collaboration rooms
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").references(() => collaborationRooms.id),
  userId: varchar("user_id").references(() => users.id),
  message: text("message").notNull(),
  messageType: varchar("message_type").notNull().default("text"), // text, system, node_mention
  metadata: jsonb("metadata"), // For storing node references, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments attached to specific nodes or canvas positions
export const workflowComments = pgTable("workflow_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  roomId: varchar("room_id").references(() => collaborationRooms.id),
  userId: varchar("user_id").references(() => users.id),
  nodeId: varchar("node_id"), // Optional - for node-specific comments
  positionX: integer("position_x"), // For canvas comments
  positionY: integer("position_y"), // For canvas comments
  content: text("content").notNull(),
  isResolved: boolean("is_resolved").default(false),
  parentCommentId: varchar("parent_comment_id"), // For replies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User credits for AI usage tracking
export const userCredits = pgTable("user_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userIdentifier: varchar("user_identifier").notNull().unique(), // Can be user ID or IP address
  credits: integer("credits").notNull().default(10), // Default 10 free credits
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unlock codes for resetting credits
export const unlockCodes = pgTable("unlock_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  creditsToAdd: integer("credits_to_add").notNull().default(10),
  isUsed: boolean("is_used").default(false),
  usedBy: varchar("used_by"), // User identifier who redeemed it
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
});

export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnlockCodeSchema = createInsertSchema(unlockCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type WorkflowSnapshot = typeof workflowSnapshots.$inferSelect;
export type InsertWorkflowSnapshot = typeof workflowSnapshots.$inferInsert;
export type CollaborationRoom = typeof collaborationRooms.$inferSelect;
export type InsertCollaborationRoom = typeof collaborationRooms.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type WorkflowComment = typeof workflowComments.$inferSelect;
export type InsertWorkflowComment = typeof workflowComments.$inferInsert;
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
export type UnlockCode = typeof unlockCodes.$inferSelect;
export type InsertUnlockCode = z.infer<typeof insertUnlockCodeSchema>;
