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

// Subscription tier type
export const subscriptionTierEnum = ['free', 'advanced', 'pro'] as const;
export type SubscriptionTier = typeof subscriptionTierEnum[number];

// Subscription status type
export const subscriptionStatusEnum = ['active', 'canceled', 'past_due', 'paused', 'trialing'] as const;
export type SubscriptionStatus = typeof subscriptionStatusEnum[number];

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Waitlist role options
export const waitlistRoleEnum = ['pm', 'design', 'engineering', 'founder'] as const;
export type WaitlistRole = typeof waitlistRoleEnum[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier").default('free'), // free, advanced, pro
  subscriptionStatus: varchar("subscription_status").default('active'), // active, canceled, past_due, paused, trialing
  billingPeriodEnd: timestamp("billing_period_end"),
  // Primary OAuth provider (legacy, maintained for backward compatibility)
  authProvider: varchar("auth_provider"), // google, github, replit
  authProviderId: varchar("auth_provider_id"), // Provider's unique user ID
  // Beta access fields
  isBeta: boolean("is_beta").default(false),
  betaGrantedAt: timestamp("beta_granted_at"),
  // Waitlist fields
  waitlistRequestedAt: timestamp("waitlist_requested_at"),
  waitlistRejectedAt: timestamp("waitlist_rejected_at"),
  waitlistRole: varchar("waitlist_role"), // pm, design, engineering, founder
  waitlistUseCase: text("waitlist_use_case"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OAuth provider links for multi-provider authentication
export const oauthProviders = pgTable("oauth_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar("provider").notNull(), // google, github, replit
  providerId: varchar("provider_id").notNull(), // Provider's unique user ID
  accessToken: text("access_token"), // Encrypted access token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  email: varchar("email"),
  displayName: varchar("display_name"),
  profileImageUrl: varchar("profile_image_url"),
  linkedAt: timestamp("linked_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
}, (table) => [
  index("IDX_oauth_providers_user").on(table.userId),
  index("IDX_oauth_providers_provider_id").on(table.provider, table.providerId),
]);

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
  isUnlimited: boolean("is_unlimited").default(false), // True for trusted users with unlimited credits
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unlock codes for resetting credits
export const unlockCodes = pgTable("unlock_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  creditsToAdd: integer("credits_to_add").notNull().default(10),
  grantsUnlimited: boolean("grants_unlimited").default(false), // True for codes that grant unlimited credits
  allowedCountries: text("allowed_countries").array().notNull().default(sql`ARRAY['US']::text[]`), // Countries allowed to use this code
  notes: text("notes"), // Admin notes about this code
  isUsed: boolean("is_used").default(false),
  isRevoked: boolean("is_revoked").default(false), // True if admin has disabled this code
  usedBy: varchar("used_by"), // User identifier who redeemed it
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics events for admin monitoring
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // credit_limit_hit, geolocation_check, code_redeemed, ai_request
  userIdentifier: varchar("user_identifier"), // User ID or IP
  country: varchar("country"), // Country code from geolocation
  metadata: jsonb("metadata"), // Additional event data (code used, request details, etc)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_analytics_event_type").on(table.eventType),
  index("IDX_analytics_created_at").on(table.createdAt),
  index("IDX_analytics_country").on(table.country),
]);

// Saved projects for Pro users (cloud storage)
export const savedProjects = pgTable("saved_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  projectUuid: varchar("project_uuid").notNull().unique().default(sql`gen_random_uuid()`), // Stable UUID for edit URLs
  shareUuid: varchar("share_uuid").unique(), // UUID for view-only share links (null until shared)
  isShareEnabled: boolean("is_share_enabled").default(false), // Whether sharing is active
  name: varchar("name").notNull(),
  description: text("description"),
  workflowData: jsonb("workflow_data").notNull(), // Full workflow JSON (nodes, edges, canvas objects, viewport)
  thumbnail: text("thumbnail"), // Base64 encoded thumbnail image
  isPublic: boolean("is_public").default(false),
  folderId: varchar("folder_id"), // For folder organization
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSharedAt: timestamp("last_shared_at"), // When sharing was last enabled
}, (table) => [
  index("IDX_saved_projects_user").on(table.userId),
  index("IDX_saved_projects_folder").on(table.folderId),
  index("IDX_saved_projects_project_uuid").on(table.projectUuid),
  index("IDX_saved_projects_share_uuid").on(table.shareUuid),
]);

// Project folders for organization
export const projectFolders = pgTable("project_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  parentFolderId: varchar("parent_folder_id"), // For nested folders
  color: varchar("color").default('#6366f1'), // Folder color
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_project_folders_user").on(table.userId),
]);

// User groups for access control
export const userGroups = pgTable("user_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  accessControls: jsonb("access_controls").default(sql`'{}'::jsonb`), // GroupAccessControls
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_user_groups_name").on(table.name),
]);

// User group memberships
export const userGroupMemberships = pgTable("user_group_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: varchar("group_id").references(() => userGroups.id, { onDelete: 'cascade' }).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("IDX_user_group_memberships_user").on(table.userId),
  index("IDX_user_group_memberships_group").on(table.groupId),
]);

// Access controls interface (for TypeScript)
export const groupAccessControlsSchema = z.object({
  unlimitedCredits: z.boolean().optional(),
  subscriptionTierOverride: z.enum(['free', 'advanced', 'pro']).optional(),
  bypassCreditCheck: z.boolean().optional(),
  monthlyCreditsOverride: z.number().optional(),
  features: z.array(z.string()).optional(),
});

export type GroupAccessControls = z.infer<typeof groupAccessControlsSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
});

export const insertSavedProjectSchema = createInsertSchema(savedProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectFolderSchema = createInsertSchema(projectFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export const insertUserGroupSchema = createInsertSchema(userGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGroupMembershipSchema = createInsertSchema(userGroupMemberships).omit({
  id: true,
  addedAt: true,
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
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type SavedProject = typeof savedProjects.$inferSelect;
export type InsertSavedProject = z.infer<typeof insertSavedProjectSchema>;
export type ProjectFolder = typeof projectFolders.$inferSelect;
export type InsertProjectFolder = z.infer<typeof insertProjectFolderSchema>;
export type OAuthProvider = typeof oauthProviders.$inferSelect;
export type InsertOAuthProvider = typeof oauthProviders.$inferInsert;
export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = z.infer<typeof insertUserGroupSchema>;
export type UserGroupMembership = typeof userGroupMemberships.$inferSelect;
export type InsertUserGroupMembership = z.infer<typeof insertUserGroupMembershipSchema>;

// Share links for view-only workflow sharing
export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareId: varchar("share_id").notNull().unique(),
  nodes: jsonb("nodes").notNull(),
  edges: jsonb("edges").notNull(),
  canvasObjects: jsonb("canvas_objects"),
  viewport: jsonb("viewport"),
  projectMetadata: jsonb("project_metadata"),
  flowSettings: jsonb("flow_settings"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;

// AI feature types for usage tracking
export const aiFeatureEnum = ['chat', 'workflow_generation', 'prd_generation', 'vision_analysis', 'image_upload', 'project_summary'] as const;
export type AiFeature = typeof aiFeatureEnum[number];

// AI model types
export const aiModelEnum = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] as const;
export type AiModel = typeof aiModelEnum[number];

// AI usage events for metrics tracking
export const aiUsageEvents = pgTable("ai_usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id"),
  workflowId: varchar("workflow_id"),
  feature: varchar("feature").notNull(), // chat, workflow_generation, prd_generation, vision_analysis, image_upload, project_summary
  model: varchar("model").notNull(), // gpt-4o, gpt-4o-mini, etc.
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  units: integer("units").notNull().default(0), // Base units (tokens / 500)
  multiplier: integer("multiplier").notNull().default(100), // Stored as percentage (100 = 1.0x, 150 = 1.5x)
  finalUnits: integer("final_units").notNull().default(0), // After multiplier
  costEstimateUSD: integer("cost_estimate_usd").notNull().default(0), // Stored in microdollars (1 cent = 10000)
  isVision: boolean("is_vision").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ai_usage_user").on(table.userId),
  index("IDX_ai_usage_created_at").on(table.createdAt),
  index("IDX_ai_usage_feature").on(table.feature),
  index("IDX_ai_usage_model").on(table.model),
]);

export const insertAiUsageEventSchema = createInsertSchema(aiUsageEvents).omit({
  id: true,
  createdAt: true,
});

export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;
export type InsertAiUsageEvent = z.infer<typeof insertAiUsageEventSchema>;

// Admin audit logs for security tracking
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey(),
  action: varchar("action").notNull(),
  adminIdentifier: varchar("admin_identifier").notNull(),
  targetId: varchar("target_id"),
  targetType: varchar("target_type"),
  details: text("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_action").on(table.action),
  index("IDX_audit_admin").on(table.adminIdentifier),
  index("IDX_audit_created_at").on(table.createdAt),
]);

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// Page view tracking for site analytics (privacy-friendly, no cookies)
export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  route: varchar("route").notNull(), // Page path like /app, /legal, /
  visitorHash: varchar("visitor_hash"), // Anonymized visitor identifier (hashed IP + UA)
  referrer: varchar("referrer"), // Referring URL
  referrerDomain: varchar("referrer_domain"), // Extracted domain from referrer
  country: varchar("country"), // Country code from geolocation
  userAgent: text("user_agent"), // Browser user agent
  deviceType: varchar("device_type"), // mobile, tablet, desktop
  isAuthenticated: boolean("is_authenticated").default(false), // Whether user was logged in
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_pageview_route").on(table.route),
  index("IDX_pageview_created_at").on(table.createdAt),
  index("IDX_pageview_visitor").on(table.visitorHash),
  index("IDX_pageview_country").on(table.country),
]);

export const insertPageViewSchema = createInsertSchema(pageViews).omit({
  id: true,
  createdAt: true,
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;

// Docs access grants - allows access to internal developer documentation without admin privileges
export const docAccessGrants = pgTable("doc_access_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  grantedByAdminId: varchar("granted_by_admin_id"), // Admin who granted access
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"), // Null if active, timestamp if revoked
  lastLoginAt: timestamp("last_login_at"), // Track when they last accessed docs
  loginToken: varchar("login_token"), // Hashed magic link token (single-use)
  tokenExpiresAt: timestamp("token_expires_at"), // Token expiration time
}, (table) => [
  index("IDX_doc_access_email").on(table.email),
  index("IDX_doc_access_revoked").on(table.revokedAt),
]);

export const insertDocAccessGrantSchema = createInsertSchema(docAccessGrants).omit({
  id: true,
  grantedAt: true,
});

export type DocAccessGrant = typeof docAccessGrants.$inferSelect;
export type InsertDocAccessGrant = z.infer<typeof insertDocAccessGrantSchema>;
