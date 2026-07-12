import { sql } from 'drizzle-orm';
import {
  check,
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

// User credits for AI usage tracking (daily reset)
export const userCredits = pgTable("user_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userIdentifier: varchar("user_identifier").notNull().unique(), // Can be user ID or IP address
  credits: integer("credits").notNull().default(25), // Daily credit allowance (free tier = 25)
  isUnlimited: boolean("is_unlimited").default(false), // True for trusted users with unlimited credits
  lastResetAt: timestamp("last_reset_at").defaultNow(), // When credits were last reset (daily reset check)
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
  isShareLocked: boolean("is_share_locked").default(false), // When true, share link stays valid but access is denied
  name: varchar("name").notNull(),
  description: text("description"),
  workflowData: jsonb("workflow_data").notNull(), // Full workflow JSON (nodes, edges, canvas objects, viewport)
  thumbnail: text("thumbnail"), // Base64 encoded thumbnail image
  isPublic: boolean("is_public").default(false),
  folderId: varchar("folder_id"), // For folder organization
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  source: varchar("source"), // Provenance: null = created in editor, 'claimed-external' = claimed via external API
  sourceExternalId: varchar("source_external_id"), // ID of the source external_workflow row if claimed
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

export const insertWorkflowCommentSchema = createInsertSchema(workflowComments).omit({
  id: true,
  userId: true,
  isResolved: true,
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
export type ValidatedInsertWorkflowComment = z.infer<typeof insertWorkflowCommentSchema>;
export type CommentWithAuthor = WorkflowComment & {
  authorName: string;
  authorImageUrl: string | null;
  /** True when the requesting user is allowed to delete this comment (author or project owner). */
  canDelete?: boolean;
};
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

// AI feature types for usage tracking — must match CreditCostType in creditService.ts
export const aiFeatureEnum = ['general_chat', 'vision_ingestion', 'workflow_reasoning', 'workflow_experiments', 'prd_generation'] as const;
export type AiFeature = typeof aiFeatureEnum[number];

// AI model types
export const aiModelEnum = ['claude-3-haiku-20240307', 'claude-3-haiku-20240307', 'claude-3-haiku-20240307', 'custom'] as const;
export type AiModel = typeof aiModelEnum[number];

// AI usage events for metrics tracking
export const aiUsageEvents = pgTable("ai_usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id"),
  workflowId: varchar("workflow_id"),
  feature: varchar("feature").notNull(), // general_chat, vision_ingestion, workflow_reasoning, workflow_experiments, prd_generation
  model: varchar("model").notNull(), // claude-3-haiku-20240307, claude-3-haiku-20240307, etc.
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  units: integer("units").notNull().default(0), // Base units (tokens / 500)
  multiplier: integer("multiplier").notNull().default(100), // Stored as percentage (100 = 1.0x, 150 = 1.5x)
  finalUnits: integer("final_units").notNull().default(0), // After multiplier
  costEstimateMicrodollars: integer("cost_estimate_microdollars").notNull().default(0), // Stored in microdollars (1 USD = 1,000,000)
  creditsCharged: integer("credits_charged"), // Credit cost deducted for this request (nullable for legacy rows)
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

// Insight history - persists acted-upon insights for user review
export const insightCategoryEnum = ['observation', 'suggestion', 'note'] as const;
export type InsightCategoryType = typeof insightCategoryEnum[number];

export const insightStatusEnum = ['new', 'viewed', 'explored', 'dismissed', 'deferred', 'promoted'] as const;
export type InsightStatusType = typeof insightStatusEnum[number];

export const insightHistory = pgTable("insight_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id"),
  workflowId: varchar("workflow_id"),
  originalInsightId: varchar("original_insight_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(),
  status: varchar("status").notNull(),
  relatedNodeIds: text("related_node_ids").array().default(sql`ARRAY[]::text[]`),
  relatedEdgeIds: text("related_edge_ids").array().default(sql`ARRAY[]::text[]`),
  explorationContext: jsonb("exploration_context"),
  createdAt: timestamp("created_at").defaultNow(),
  actedAt: timestamp("acted_at").defaultNow(),
  viewedAt: timestamp("viewed_at"),
  exploredAt: timestamp("explored_at"),
  dismissedAt: timestamp("dismissed_at"),
  deferredAt: timestamp("deferred_at"),
  promotedAt: timestamp("promoted_at"),
}, (table) => [
  index("IDX_insight_history_user").on(table.userId),
  index("IDX_insight_history_project").on(table.projectId),
  index("IDX_insight_history_workflow").on(table.workflowId),
  index("IDX_insight_history_status").on(table.status),
  index("IDX_insight_history_acted_at").on(table.actedAt),
]);

export const insertInsightHistorySchema = createInsertSchema(insightHistory).omit({
  id: true,
  createdAt: true,
});

export type InsightHistory = typeof insightHistory.$inferSelect;
export type InsertInsightHistory = z.infer<typeof insertInsightHistorySchema>;

// ============================================
// FEATURE FLAGS SYSTEM
// ============================================

// Rollout status for feature flags
export const featureFlagStatusEnum = ['disabled', 'beta', 'ga', 'deprecated'] as const;
export type FeatureFlagStatus = typeof featureFlagStatusEnum[number];

// Feature flags definition table
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g. "ai.workflowGeneration", "canvas.autoLayout"
  name: varchar("name").notNull(), // Human-readable name
  description: text("description"),
  category: varchar("category").notNull(), // ai, canvas, chat, enterprise, integrations
  parentKey: varchar("parent_key"), // For sub-features, references parent flag key
  status: varchar("status").notNull().default('disabled'), // disabled, beta, ga, deprecated
  defaultEnabled: boolean("default_enabled").default(false), // Default state for all users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_feature_flags_key").on(table.key),
  index("IDX_feature_flags_category").on(table.category),
  index("IDX_feature_flags_parent").on(table.parentKey),
  index("IDX_feature_flags_status").on(table.status),
]);

// Feature groups - collections of users with access to specific flags
export const featureGroups = pgTable("feature_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // e.g. "Beta Testers", "Enterprise", "Internal"
  description: text("description"),
  color: varchar("color").default('#6366f1'), // For UI display
  isDefault: boolean("is_default").default(false), // If true, all new users get added
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_feature_groups_name").on(table.name),
]);

// Maps which flags are enabled for which groups
export const featureGroupFlags = pgTable("feature_group_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => featureGroups.id, { onDelete: 'cascade' }).notNull(),
  flagKey: varchar("flag_key").references(() => featureFlags.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_feature_group_flags_group").on(table.groupId),
  index("IDX_feature_group_flags_flag").on(table.flagKey),
]);

// Maps users to feature groups
export const featureGroupMemberships = pgTable("feature_group_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: varchar("group_id").references(() => featureGroups.id, { onDelete: 'cascade' }).notNull(),
  addedBy: varchar("added_by"), // Admin who added this membership
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("IDX_feature_group_memberships_user").on(table.userId),
  index("IDX_feature_group_memberships_group").on(table.groupId),
]);

// User-specific flag overrides (takes precedence over group membership)
export const userFeatureOverrides = pgTable("user_feature_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  flagKey: varchar("flag_key").references(() => featureFlags.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason"), // Why this override was applied
  createdBy: varchar("created_by"), // Admin who created override
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration
}, (table) => [
  index("IDX_user_feature_overrides_user").on(table.userId),
  index("IDX_user_feature_overrides_flag").on(table.flagKey),
]);

// Insert schemas
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureGroupSchema = createInsertSchema(featureGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureGroupFlagSchema = createInsertSchema(featureGroupFlags).omit({
  id: true,
  createdAt: true,
});

export const insertFeatureGroupMembershipSchema = createInsertSchema(featureGroupMemberships).omit({
  id: true,
  addedAt: true,
});

export const insertUserFeatureOverrideSchema = createInsertSchema(userFeatureOverrides).omit({
  id: true,
  createdAt: true,
});

// Types
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureGroup = typeof featureGroups.$inferSelect;
export type InsertFeatureGroup = z.infer<typeof insertFeatureGroupSchema>;
export type FeatureGroupFlag = typeof featureGroupFlags.$inferSelect;
export type InsertFeatureGroupFlag = z.infer<typeof insertFeatureGroupFlagSchema>;
export type FeatureGroupMembership = typeof featureGroupMemberships.$inferSelect;
export type InsertFeatureGroupMembership = z.infer<typeof insertFeatureGroupMembershipSchema>;
export type UserFeatureOverride = typeof userFeatureOverrides.$inferSelect;
export type InsertUserFeatureOverride = z.infer<typeof insertUserFeatureOverrideSchema>;

// Resolved flag state for a user (used by frontend)
export interface ResolvedFeatureFlags {
  [key: string]: {
    enabled: boolean;
    source: 'override' | 'group' | 'default';
    groupName?: string;
  };
}

// ============================================
// ANNOUNCEMENTS / BROADCAST BANNERS
// ============================================

export const announcementTypeEnum = ['info', 'warning', 'success', 'critical'] as const;
export type AnnouncementType = typeof announcementTypeEnum[number];

export const announcementAudienceEnum = ['all', 'free', 'advanced', 'pro', 'paid', 'beta'] as const;
export type AnnouncementAudience = typeof announcementAudienceEnum[number];

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type").notNull().default('info'), // info, warning, success, critical
  targetAudience: varchar("target_audience").notNull().default('all'), // all, free, advanced, pro, paid, beta
  ctaLabel: varchar("cta_label"), // Optional CTA button label
  ctaUrl: varchar("cta_url"),     // Optional CTA button URL
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"), // Null = never expires
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_announcements_active").on(table.isActive),
  index("IDX_announcements_audience").on(table.targetAudience),
  index("IDX_announcements_expires").on(table.expiresAt),
]);

export const announcementDismissals = pgTable("announcement_dismissals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").references(() => announcements.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  dismissedAt: timestamp("dismissed_at").defaultNow(),
}, (table) => [
  index("IDX_announcement_dismissals_ann").on(table.announcementId),
  index("IDX_announcement_dismissals_user").on(table.userId),
]);

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnnouncementDismissalSchema = createInsertSchema(announcementDismissals).omit({
  id: true,
  dismissedAt: true,
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnnouncementDismissal = typeof announcementDismissals.$inferSelect;

// ============================================
// BAN SYSTEM
// ============================================

export const bannedEmails = pgTable("banned_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  userId: varchar("user_id"),      // DB user id at time of ban (nullable — email-only bans allowed)
  displayName: varchar("display_name"), // Cached for admin table display
  oauthSub: varchar("oauth_sub"),  // Stable OAuth provider sub/uid to block re-registration
  reason: text("reason"),          // Internal admin reason (never shown to user)
  accountDeleted: boolean("account_deleted").notNull().default(false), // true = ban + wipe performed
  loginAttempts: integer("login_attempts").notNull().default(0), // # of sign-in attempts after ban
  bannedAt: timestamp("banned_at").defaultNow(),
}, (table) => [
  index("IDX_banned_emails_user_id").on(table.userId),
]);

export const insertBannedEmailSchema = createInsertSchema(bannedEmails).omit({
  id: true,
  bannedAt: true,
});

export type BannedEmail = typeof bannedEmails.$inferSelect;
export type InsertBannedEmail = z.infer<typeof insertBannedEmailSchema>;

// Scoped API keys for external integrations (e.g. Claude Code skill).
// Raw key is never stored — only its sha256 hash. Printed once at issuance time.
export const externalApiKeys = pgTable("external_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // human label, e.g. "claude-code-skill"
  keyHash: varchar("key_hash").notNull().unique(), // sha256 hex digest of the raw key
  revokedAt: timestamp("revoked_at"), // non-null = revoked, always reject
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_external_api_keys_key_hash").on(table.keyHash),
]);

export type ExternalApiKey = typeof externalApiKeys.$inferSelect;
export type InsertExternalApiKey = typeof externalApiKeys.$inferInsert;

// Workflows submitted via the external API (e.g. from the Claude Code skill).
// Rendered read-only at /workflows/:id — intentionally separate from
// savedProjects/shareLinks since there's no owning user or PRD/notes data.
export const externalEntities = pgTable("external_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'workflow' | 'design'
  apiKeyId: varchar("api_key_id").references(() => externalApiKeys.id).notNull(),
  data: jsonb("data").notNull(),
  sourceEntityId: varchar("source_entity_id").references((): any => externalEntities.id), // nullable self-ref
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '24 hours'`),
}, (table) => [
  index("IDX_external_entities_api_key").on(table.apiKeyId),
  index("IDX_external_entities_expires_at").on(table.expiresAt),
  index("IDX_external_entities_type").on(table.entityType),
  check("external_entities_entity_type_check", sql`${table.entityType} IN ('workflow', 'design')`),
]);

export const insertExternalEntitySchema = createInsertSchema(externalEntities).omit({
  id: true,
  createdAt: true,
  expiresAt: true,
  updatedAt: true,
});

export type ExternalEntity = typeof externalEntities.$inferSelect;
export type InsertExternalEntity = z.infer<typeof insertExternalEntitySchema>;
