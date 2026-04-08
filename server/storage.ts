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
  users,
  savedProjects,
  projectFolders,
  shareLinks,
  insightHistory,
  userCredits,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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
    // Delete user row — oauthProviders and userGroupMemberships cascade automatically
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
}

export const storage = new DatabaseStorage();
