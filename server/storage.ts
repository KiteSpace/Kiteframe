import { 
  type User, 
  type UpsertUser, 
  type SavedProject, 
  type InsertSavedProject,
  type ProjectFolder,
  type InsertProjectFolder,
  type ShareLink,
  type InsertShareLink,
  type InsightHistory,
  type InsertInsightHistory,
  type BannedEmail,
  type InsertBannedEmail,
  type WorkflowComment,
  type InsertWorkflowComment,
  type CommentWithAuthor,
  type ExternalApiKey,
  type InsertExternalApiKey,
  type ExternalEntity,
  type InsertExternalEntity,
  type Design,
  type InsertDesign,
  type DesignSummary,
  users,
  savedProjects,
  projectFolders,
  shareLinks,
  insightHistory,
  userCredits,
  aiUsageEvents,
  workflowSnapshots,
  collaborationRooms,
  roomParticipants,
  chatMessages,
  workflowComments,
  bannedEmails,
  externalApiKeys,
  externalEntities,
  designs,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, isNotNull, sql, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSubscription(userId: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getSavedProjects(userId: string): Promise<SavedProject[]>;
  getSavedProject(id: string, userId: string): Promise<SavedProject | undefined>;
  getProjectByProjectUuid(projectUuid: string): Promise<SavedProject | undefined>;
  getProjectByShareUuid(shareUuid: string): Promise<SavedProject | undefined>;
  enableProjectSharing(id: string, userId: string): Promise<SavedProject | undefined>;
  disableProjectSharing(id: string, userId: string): Promise<SavedProject | undefined>;
  setProjectShareLock(id: string, userId: string, locked: boolean): Promise<SavedProject | undefined>;
  createSavedProject(project: InsertSavedProject): Promise<SavedProject>;
  updateSavedProject(id: string, userId: string, data: Partial<InsertSavedProject>): Promise<SavedProject | undefined>;
  deleteSavedProject(id: string, userId: string): Promise<void>;
  deleteAllUserProjects(userId: string): Promise<void>;
  getProjectFolders(userId: string): Promise<ProjectFolder[]>;
  createProjectFolder(folder: InsertProjectFolder): Promise<ProjectFolder>;
  updateProjectFolder(id: string, userId: string, data: Partial<InsertProjectFolder>): Promise<ProjectFolder | undefined>;
  deleteProjectFolder(id: string, userId: string): Promise<void>;
  createShareLink(data: InsertShareLink): Promise<ShareLink>;
  getShareLink(shareId: string): Promise<ShareLink | undefined>;
  updateShareLink(shareId: string, data: Partial<InsertShareLink>): Promise<ShareLink | undefined>;
  // Insight history
  getInsightHistory(userId: string, projectId?: string): Promise<InsightHistory[]>;
  createInsightHistory(data: InsertInsightHistory): Promise<InsightHistory>;
  updateInsightHistory(id: string, data: Partial<InsertInsightHistory>): Promise<InsightHistory | undefined>;
  getUsersWithMismatchedTier(): Promise<User[]>;
  // Workflow comments
  createComment(data: InsertWorkflowComment): Promise<WorkflowComment>;
  getCommentsByWorkflow(workflowId: string): Promise<CommentWithAuthor[]>;
  getCommentById(id: string): Promise<WorkflowComment | undefined>;
  setCommentResolved(id: string, isResolved: boolean): Promise<WorkflowComment | undefined>;
  deleteComment(id: string): Promise<void>;
  // Ban management
  getBannedEmail(email: string): Promise<BannedEmail | undefined>;
  listBannedEmails(): Promise<BannedEmail[]>;
  createBannedEmail(data: InsertBannedEmail): Promise<BannedEmail>;
  deleteBannedEmail(id: string): Promise<void>;
  incrementBanLoginAttempts(email: string): Promise<void>;
  // External API keys (Claude Code skill, etc.)
  getExternalApiKeyByHash(keyHash: string): Promise<ExternalApiKey | undefined>;
  createExternalApiKey(data: InsertExternalApiKey): Promise<ExternalApiKey>;
  touchExternalApiKeyLastUsed(id: string): Promise<void>;
  // External entities (workflows, designs — submitted via external API)
  createExternalEntity(data: InsertExternalEntity): Promise<ExternalEntity>;
  getExternalEntity(id: string, entityType?: string): Promise<ExternalEntity | undefined>;
  updateExternalEntity(id: string, entityType: string, data: { data: unknown }): Promise<ExternalEntity | undefined>;
  deleteExpiredExternalEntities(): Promise<number>;
  // Designs — craft.js canvas designs
  createDesign(data: InsertDesign): Promise<Design>;
  getDesign(id: string): Promise<Design | undefined>;
  updateDesign(id: string, data: Partial<InsertDesign>): Promise<Design | undefined>;
  claimDesign(id: string, userId: string): Promise<Design | undefined>;
  listDesignsByUser(userId: string): Promise<DesignSummary[]>;
  enableDesignSharing(id: string, userId: string): Promise<Design | undefined>;
  disableDesignSharing(id: string, userId: string): Promise<Design | undefined>;
  getDesignByShareUuid(shareUuid: string): Promise<Design | undefined>;
  /** Returns the updatedAt timestamp of the saved_project with the given ID, or null if not found. */
  getWorkflowUpdatedAt(projectId: string): Promise<Date | null>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = userData.id ? await this.getUser(userData.id) : undefined;
    
    const dataToInsert = {
      ...userData,
      subscriptionTier: userData.subscriptionTier || existingUser?.subscriptionTier || 'free',
      subscriptionStatus: userData.subscriptionStatus || existingUser?.subscriptionStatus || 'active',
    };
    
    const [user] = await db
      .insert(users)
      .values(dataToInsert)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: dataToInsert.email,
          firstName: dataToInsert.firstName,
          lastName: dataToInsert.lastName,
          profileImageUrl: dataToInsert.profileImageUrl,
          authProvider: dataToInsert.authProvider,
          authProviderId: dataToInsert.authProviderId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserSubscription(userId: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    // Delete savedProjects (notNull FK — must precede user row deletion)
    await this.deleteAllUserProjects(id);
    // Delete projectFolders (notNull FK — must precede user row deletion)
    await db.delete(projectFolders).where(eq(projectFolders.userId, id));
    // Delete insight history (nullable FK, no cascade — clean up orphan rows)
    await db.delete(insightHistory).where(eq(insightHistory.userId, id));
    // Delete credit record (keyed by userIdentifier which equals userId for signed-in users)
    await db.delete(userCredits).where(eq(userCredits.userIdentifier, id));
    // Delete the user's own content in rooms they participate in (userId FK, NO ACTION)
    await db.delete(workflowComments).where(eq(workflowComments.userId, id));
    await db.delete(chatMessages).where(eq(chatMessages.userId, id));
    await db.delete(roomParticipants).where(eq(roomParticipants.userId, id));
    // For rooms the user owns, remove ALL sub-records by roomId (other users' data too)
    // so the room rows can be deleted without violating NO ACTION roomId constraints
    const ownedRooms = await db.select({ id: collaborationRooms.id })
      .from(collaborationRooms)
      .where(eq(collaborationRooms.ownerId, id));
    if (ownedRooms.length > 0) {
      const ownedRoomIds = ownedRooms.map(r => r.id);
      await db.delete(workflowComments).where(inArray(workflowComments.roomId, ownedRoomIds));
      await db.delete(chatMessages).where(inArray(chatMessages.roomId, ownedRoomIds));
      await db.delete(roomParticipants).where(inArray(roomParticipants.roomId, ownedRoomIds));
      await db.delete(collaborationRooms).where(inArray(collaborationRooms.id, ownedRoomIds));
    }
    // Delete remaining nullable-FK rows with NO ACTION constraints
    await db.delete(workflowSnapshots).where(eq(workflowSnapshots.userId, id));
    await db.delete(aiUsageEvents).where(eq(aiUsageEvents.userId, id));
    // Delete user row — oauthProviders, userGroupMemberships, and announcement_dismissals cascade automatically
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getSavedProjects(userId: string): Promise<SavedProject[]> {
    return db
      .select()
      .from(savedProjects)
      .where(eq(savedProjects.userId, userId))
      .orderBy(desc(savedProjects.updatedAt));
  }

  async getSavedProject(id: string, userId: string): Promise<SavedProject | undefined> {
    const [project] = await db
      .select()
      .from(savedProjects)
      .where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)));
    return project;
  }

  async getProjectByProjectUuid(projectUuid: string): Promise<SavedProject | undefined> {
    const [project] = await db
      .select()
      .from(savedProjects)
      .where(eq(savedProjects.projectUuid, projectUuid));
    return project;
  }

  async getProjectByShareUuid(shareUuid: string): Promise<SavedProject | undefined> {
    const [project] = await db
      .select()
      .from(savedProjects)
      .where(and(eq(savedProjects.shareUuid, shareUuid), eq(savedProjects.isShareEnabled, true)));
    return project;
  }

  async enableProjectSharing(id: string, userId: string): Promise<SavedProject | undefined> {
    const [updated] = await db
      .update(savedProjects)
      .set({
        isShareEnabled: true,
        isShareLocked: false, // a freshly (re-)shared link always starts unlocked
        shareUuid: crypto.randomUUID(),
        lastSharedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)))
      .returning();
    return updated;
  }

  async disableProjectSharing(id: string, userId: string): Promise<SavedProject | undefined> {
    const [updated] = await db
      .update(savedProjects)
      .set({
        isShareEnabled: false,
        isShareLocked: false, // clear lock so a later re-share starts clean
        updatedAt: new Date(),
      })
      .where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)))
      .returning();
    return updated;
  }

  async setProjectShareLock(id: string, userId: string, locked: boolean): Promise<SavedProject | undefined> {
    const [updated] = await db
      .update(savedProjects)
      .set({
        isShareLocked: locked,
        updatedAt: new Date(),
      })
      .where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)))
      .returning();
    return updated;
  }

  async createSavedProject(project: InsertSavedProject): Promise<SavedProject> {
    const [created] = await db.insert(savedProjects).values(project).returning();
    return created;
  }

  async updateSavedProject(id: string, userId: string, data: Partial<InsertSavedProject>): Promise<SavedProject | undefined> {
    const [updated] = await db
      .update(savedProjects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)))
      .returning();
    return updated;
  }

  async deleteSavedProject(id: string, userId: string): Promise<void> {
    await db.delete(savedProjects).where(and(eq(savedProjects.id, id), eq(savedProjects.userId, userId)));
  }

  async deleteAllUserProjects(userId: string): Promise<void> {
    await db.delete(savedProjects).where(eq(savedProjects.userId, userId));
  }

  async getProjectFolders(userId: string): Promise<ProjectFolder[]> {
    return db
      .select()
      .from(projectFolders)
      .where(eq(projectFolders.userId, userId))
      .orderBy(projectFolders.name);
  }

  async createProjectFolder(folder: InsertProjectFolder): Promise<ProjectFolder> {
    const [created] = await db.insert(projectFolders).values(folder).returning();
    return created;
  }

  async updateProjectFolder(id: string, userId: string, data: Partial<InsertProjectFolder>): Promise<ProjectFolder | undefined> {
    const [updated] = await db
      .update(projectFolders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(projectFolders.id, id), eq(projectFolders.userId, userId)))
      .returning();
    return updated;
  }

  async deleteProjectFolder(id: string, userId: string): Promise<void> {
    await db.update(savedProjects).set({ folderId: null }).where(eq(savedProjects.folderId, id));
    await db.delete(projectFolders).where(and(eq(projectFolders.id, id), eq(projectFolders.userId, userId)));
  }

  async createShareLink(data: InsertShareLink): Promise<ShareLink> {
    // Ensure JSONB fields are properly serialized
    const serialized = {
      ...data,
      nodes: JSON.parse(JSON.stringify(data.nodes)), // Convert to plain JSON
      edges: JSON.parse(JSON.stringify(data.edges)),
      canvasObjects: data.canvasObjects ? JSON.parse(JSON.stringify(data.canvasObjects)) : null,
      viewport: data.viewport ? JSON.parse(JSON.stringify(data.viewport)) : null,
      projectMetadata: data.projectMetadata ? JSON.parse(JSON.stringify(data.projectMetadata)) : null,
    };
    const [created] = await db.insert(shareLinks).values(serialized).returning();
    return created;
  }

  async getShareLink(shareId: string): Promise<ShareLink | undefined> {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.shareId, shareId));
    if (!link) return undefined;
    
    // Ensure JSONB fields are properly deserialized
    return {
      ...link,
      nodes: Array.isArray(link.nodes) ? link.nodes : [],
      edges: Array.isArray(link.edges) ? link.edges : [],
      canvasObjects: Array.isArray(link.canvasObjects) ? link.canvasObjects : undefined,
      viewport: link.viewport ? link.viewport : undefined,
      projectMetadata: link.projectMetadata ? link.projectMetadata : undefined,
    };
  }

  async updateShareLink(shareId: string, data: Partial<InsertShareLink>): Promise<ShareLink | undefined> {
    // Serialize JSONB fields if present
    const serialized: Record<string, any> = {};
    if (data.nodes !== undefined) {
      serialized.nodes = JSON.parse(JSON.stringify(data.nodes));
    }
    if (data.edges !== undefined) {
      serialized.edges = JSON.parse(JSON.stringify(data.edges));
    }
    if (data.canvasObjects !== undefined) {
      serialized.canvasObjects = JSON.parse(JSON.stringify(data.canvasObjects));
    }
    if (data.viewport !== undefined) {
      serialized.viewport = JSON.parse(JSON.stringify(data.viewport));
    }
    if (data.projectMetadata !== undefined) {
      serialized.projectMetadata = JSON.parse(JSON.stringify(data.projectMetadata));
    }
    if (data.flowSettings !== undefined) {
      serialized.flowSettings = JSON.parse(JSON.stringify(data.flowSettings));
    }

    const [updated] = await db
      .update(shareLinks)
      .set(serialized)
      .where(eq(shareLinks.shareId, shareId))
      .returning();
    
    if (!updated) return undefined;
    
    return {
      ...updated,
      nodes: Array.isArray(updated.nodes) ? updated.nodes : [],
      edges: Array.isArray(updated.edges) ? updated.edges : [],
      canvasObjects: Array.isArray(updated.canvasObjects) ? updated.canvasObjects : undefined,
      viewport: updated.viewport ? updated.viewport : undefined,
      projectMetadata: updated.projectMetadata ? updated.projectMetadata : undefined,
    };
  }

  // Insight history methods
  async getInsightHistory(userId: string, projectId?: string): Promise<InsightHistory[]> {
    if (projectId) {
      return db
        .select()
        .from(insightHistory)
        .where(and(eq(insightHistory.userId, userId), eq(insightHistory.projectId, projectId)))
        .orderBy(desc(insightHistory.actedAt));
    }
    return db
      .select()
      .from(insightHistory)
      .where(eq(insightHistory.userId, userId))
      .orderBy(desc(insightHistory.actedAt));
  }

  async createInsightHistory(data: InsertInsightHistory): Promise<InsightHistory> {
    const [entry] = await db
      .insert(insightHistory)
      .values({
        ...data,
        explorationContext: data.explorationContext ? JSON.parse(JSON.stringify(data.explorationContext)) : null,
      })
      .returning();
    return entry;
  }

  async updateInsightHistory(id: string, data: Partial<InsertInsightHistory>): Promise<InsightHistory | undefined> {
    const serialized: Record<string, any> = { ...data };
    if (data.explorationContext !== undefined) {
      serialized.explorationContext = JSON.parse(JSON.stringify(data.explorationContext));
    }
    const [updated] = await db
      .update(insightHistory)
      .set(serialized)
      .where(eq(insightHistory.id, id))
      .returning();
    return updated;
  }

  async getUsersWithMismatchedTier(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          isNotNull(users.stripeSubscriptionId),
          inArray(users.subscriptionStatus, ['active', 'trialing']),
          eq(users.subscriptionTier, 'free'),
        )
      );
  }

  async getBannedEmail(email: string): Promise<BannedEmail | undefined> {
    const [row] = await db
      .select()
      .from(bannedEmails)
      .where(eq(bannedEmails.email, email.toLowerCase()))
      .limit(1);
    return row;
  }

  async listBannedEmails(): Promise<BannedEmail[]> {
    return db
      .select()
      .from(bannedEmails)
      .orderBy(desc(bannedEmails.bannedAt));
  }

  async createBannedEmail(data: InsertBannedEmail): Promise<BannedEmail> {
    const [row] = await db
      .insert(bannedEmails)
      .values({ ...data, email: data.email.toLowerCase() })
      .returning();
    return row;
  }

  async deleteBannedEmail(id: string): Promise<void> {
    await db.delete(bannedEmails).where(eq(bannedEmails.id, id));
  }

  async incrementBanLoginAttempts(email: string): Promise<void> {
    await db
      .update(bannedEmails)
      .set({ loginAttempts: sql`${bannedEmails.loginAttempts} + 1` })
      .where(eq(bannedEmails.email, email.toLowerCase()));
  }

  // Workflow comments
  async createComment(data: InsertWorkflowComment): Promise<WorkflowComment> {
    const [row] = await db.insert(workflowComments).values(data).returning();
    return row;
  }

  async getCommentsByWorkflow(workflowId: string): Promise<CommentWithAuthor[]> {
    const rows = await db
      .select({
        comment: workflowComments,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      })
      .from(workflowComments)
      .leftJoin(users, eq(workflowComments.userId, users.id))
      .where(eq(workflowComments.workflowId, workflowId))
      .orderBy(workflowComments.createdAt);

    return rows.map((row) => {
      const nameParts = [row.firstName, row.lastName].filter(Boolean);
      let authorName = nameParts.join(" ").trim();
      if (!authorName) authorName = row.email || "";
      if (!authorName) authorName = "Anonymous";
      return {
        ...row.comment,
        authorName,
        authorImageUrl: row.profileImageUrl ?? null,
      };
    });
  }

  async getCommentById(id: string): Promise<WorkflowComment | undefined> {
    const [row] = await db
      .select()
      .from(workflowComments)
      .where(eq(workflowComments.id, id))
      .limit(1);
    return row;
  }

  async setCommentResolved(id: string, isResolved: boolean): Promise<WorkflowComment | undefined> {
    const [row] = await db
      .update(workflowComments)
      .set({ isResolved, updatedAt: new Date() })
      .where(eq(workflowComments.id, id))
      .returning();
    return row;
  }

  async deleteComment(id: string): Promise<void> {
    // Delete the comment and any replies that point to it.
    await db.delete(workflowComments).where(eq(workflowComments.parentCommentId, id));
    await db.delete(workflowComments).where(eq(workflowComments.id, id));
  }

  // External API keys
  async getExternalApiKeyByHash(keyHash: string): Promise<ExternalApiKey | undefined> {
    const [row] = await db
      .select()
      .from(externalApiKeys)
      .where(eq(externalApiKeys.keyHash, keyHash))
      .limit(1);
    return row;
  }

  async createExternalApiKey(data: InsertExternalApiKey): Promise<ExternalApiKey> {
    const [row] = await db.insert(externalApiKeys).values(data).returning();
    return row;
  }

  async touchExternalApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(externalApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalApiKeys.id, id));
  }

  // External entities (workflows, designs)
  async createExternalEntity(data: InsertExternalEntity): Promise<ExternalEntity> {
    const [row] = await db
      .insert(externalEntities)
      .values({ ...data, data: JSON.parse(JSON.stringify(data.data)) })
      .returning();
    return row;
  }

  async getExternalEntity(id: string, entityType?: string): Promise<ExternalEntity | undefined> {
    const conditions = entityType
      ? and(eq(externalEntities.id, id), eq(externalEntities.entityType, entityType))
      : eq(externalEntities.id, id);
    const [row] = await db
      .select()
      .from(externalEntities)
      .where(conditions)
      .limit(1);
    return row;
  }

  async updateExternalEntity(id: string, entityType: string, data: { data: unknown }): Promise<ExternalEntity | undefined> {
    const [row] = await db
      .update(externalEntities)
      .set({
        data: JSON.parse(JSON.stringify(data.data)) as any,
        updatedAt: new Date(),
      })
      .where(and(eq(externalEntities.id, id), eq(externalEntities.entityType, entityType)))
      .returning();
    return row;
  }

  async deleteExpiredExternalEntities(): Promise<number> {
    const result = await db
      .delete(externalEntities)
      .where(lt(externalEntities.expiresAt, sql`now()`))
      .returning({ id: externalEntities.id });
    return result.length;
  }

  // Designs — craft.js canvas designs
  async createDesign(data: InsertDesign): Promise<Design> {
    const [row] = await db.insert(designs).values({
      ...data,
      craftState: typeof data.craftState === "string"
        ? JSON.parse(data.craftState as string)
        : data.craftState,
    }).returning();
    return row;
  }

  async getDesign(id: string): Promise<Design | undefined> {
    const [row] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
    return row;
  }

  async updateDesign(id: string, data: Partial<InsertDesign>): Promise<Design | undefined> {
    const payload: Record<string, unknown> = { updatedAt: new Date() };
    if (data.craftState !== undefined) {
      payload.craftState = typeof data.craftState === "string"
        ? JSON.parse(data.craftState as string)
        : data.craftState;
    }
    if (data.title !== undefined) payload.title = data.title;
    if (data.notes !== undefined) payload.notes = data.notes;
    const [row] = await db.update(designs).set(payload).where(eq(designs.id, id)).returning();
    return row;
  }

  async claimDesign(id: string, userId: string): Promise<Design | undefined> {
    // Only claim if unclaimed — prevents overwriting an existing owner
    const [row] = await db
      .update(designs)
      .set({ claimedByUserId: userId, updatedAt: new Date() })
      .where(and(eq(designs.id, id), sql`claimed_by_user_id IS NULL`))
      .returning();
    return row;
  }

  /**
   * Interfaces owned by a user, for the project grid. Deliberately selects
   * columns rather than the whole row: craftState is the entire canvas and
   * would make this list enormous, and the grid only needs a label, a
   * timestamp and the share state. The owner id is never selected so it
   * cannot leak into a response by accident.
   */
  async listDesignsByUser(userId: string): Promise<DesignSummary[]> {
    return await db
      .select({
        id: designs.id,
        title: designs.title,
        shareUuid: designs.shareUuid,
        isShareEnabled: designs.isShareEnabled,
        createdAt: designs.createdAt,
        updatedAt: designs.updatedAt,
      })
      .from(designs)
      .where(eq(designs.claimedByUserId, userId))
      .orderBy(desc(designs.updatedAt));
  }

  async enableDesignSharing(id: string, userId: string): Promise<Design | undefined> {
    const [updated] = await db
      .update(designs)
      .set({
        isShareEnabled: true,
        shareUuid: crypto.randomUUID(),
        lastSharedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(designs.id, id), eq(designs.claimedByUserId, userId)))
      .returning();
    return updated;
  }

  async disableDesignSharing(id: string, userId: string): Promise<Design | undefined> {
    // shareUuid is deliberately left in place, mirroring saved_projects: the
    // link is dead because isShareEnabled is false, and re-sharing mints a new
    // uuid so the old one can never be revived.
    const [updated] = await db
      .update(designs)
      .set({ isShareEnabled: false, updatedAt: new Date() })
      .where(and(eq(designs.id, id), eq(designs.claimedByUserId, userId)))
      .returning();
    return updated;
  }

  /** Resolves only while sharing is switched on, so revoking kills the link. */
  async getDesignByShareUuid(shareUuid: string): Promise<Design | undefined> {
    const [row] = await db
      .select()
      .from(designs)
      .where(and(eq(designs.shareUuid, shareUuid), eq(designs.isShareEnabled, true)))
      .limit(1);
    return row;
  }

  async getWorkflowUpdatedAt(projectId: string): Promise<Date | null> {
    const [row] = await db
      .select({ updatedAt: savedProjects.updatedAt })
      .from(savedProjects)
      .where(eq(savedProjects.id, projectId))
      .limit(1);
    return row?.updatedAt ?? null;
  }
}

export const storage = new DatabaseStorage();
