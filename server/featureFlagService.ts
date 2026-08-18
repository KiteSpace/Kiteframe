import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";
import {
  featureFlags,
  featureGroups,
  featureGroupFlags,
  featureGroupMemberships,
  userFeatureOverrides,
  type FeatureFlag,
  type InsertFeatureFlag,
  type FeatureGroup,
  type InsertFeatureGroup,
  type FeatureGroupFlag,
  type InsertFeatureGroupFlag,
  type FeatureGroupMembership,
  type InsertFeatureGroupMembership,
  type UserFeatureOverride,
  type InsertUserFeatureOverride,
  type ResolvedFeatureFlags,
  users,
} from "@shared/schema";

export class FeatureFlagService {
  // ============================================
  // FEATURE FLAGS CRUD
  // ============================================

  async getAllFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).orderBy(featureFlags.category, featureFlags.key);
  }

  async getFlag(key: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
    return flag;
  }

  async createFlag(data: InsertFeatureFlag): Promise<FeatureFlag> {
    const [flag] = await db.insert(featureFlags).values(data).returning();
    return flag;
  }

  async updateFlag(key: string, data: Partial<InsertFeatureFlag>): Promise<FeatureFlag | undefined> {
    const [flag] = await db
      .update(featureFlags)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();
    return flag;
  }

  async deleteFlag(key: string): Promise<void> {
    await db.delete(featureFlags).where(eq(featureFlags.key, key));
  }

  async getFlagsByCategory(category: string): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).where(eq(featureFlags.category, category));
  }

  // ============================================
  // FEATURE GROUPS CRUD
  // ============================================

  async getAllGroups(): Promise<FeatureGroup[]> {
    return db.select().from(featureGroups).orderBy(featureGroups.name);
  }

  async getGroup(id: string): Promise<FeatureGroup | undefined> {
    const [group] = await db.select().from(featureGroups).where(eq(featureGroups.id, id));
    return group;
  }

  async getGroupByName(name: string): Promise<FeatureGroup | undefined> {
    const [group] = await db.select().from(featureGroups).where(eq(featureGroups.name, name));
    return group;
  }

  async createGroup(data: InsertFeatureGroup): Promise<FeatureGroup> {
    const [group] = await db.insert(featureGroups).values(data).returning();
    return group;
  }

  async updateGroup(id: string, data: Partial<InsertFeatureGroup>): Promise<FeatureGroup | undefined> {
    const [group] = await db
      .update(featureGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featureGroups.id, id))
      .returning();
    return group;
  }

  async deleteGroup(id: string): Promise<void> {
    await db.delete(featureGroups).where(eq(featureGroups.id, id));
  }

  // ============================================
  // GROUP-FLAG ASSIGNMENTS
  // ============================================

  async getGroupFlags(groupId: string): Promise<FeatureGroupFlag[]> {
    return db.select().from(featureGroupFlags).where(eq(featureGroupFlags.groupId, groupId));
  }

  async assignFlagToGroup(data: InsertFeatureGroupFlag): Promise<FeatureGroupFlag> {
    const existing = await db
      .select()
      .from(featureGroupFlags)
      .where(and(eq(featureGroupFlags.groupId, data.groupId), eq(featureGroupFlags.flagKey, data.flagKey)));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(featureGroupFlags)
        .set({ enabled: data.enabled })
        .where(eq(featureGroupFlags.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [assignment] = await db.insert(featureGroupFlags).values(data).returning();
    return assignment;
  }

  async removeFlagFromGroup(groupId: string, flagKey: string): Promise<void> {
    await db
      .delete(featureGroupFlags)
      .where(and(eq(featureGroupFlags.groupId, groupId), eq(featureGroupFlags.flagKey, flagKey)));
  }

  // ============================================
  // GROUP MEMBERSHIPS
  // ============================================

  async getGroupMembers(groupId: string): Promise<{ membership: FeatureGroupMembership; user: { id: string; email: string | null; firstName: string | null; lastName: string | null } }[]> {
    const memberships = await db
      .select({
        membership: featureGroupMemberships,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(featureGroupMemberships)
      .innerJoin(users, eq(featureGroupMemberships.userId, users.id))
      .where(eq(featureGroupMemberships.groupId, groupId));
    return memberships;
  }

  async getUserGroups(userId: string): Promise<FeatureGroup[]> {
    const memberships = await db
      .select({ group: featureGroups })
      .from(featureGroupMemberships)
      .innerJoin(featureGroups, eq(featureGroupMemberships.groupId, featureGroups.id))
      .where(eq(featureGroupMemberships.userId, userId));
    return memberships.map((m) => m.group);
  }

  async addUserToGroup(data: InsertFeatureGroupMembership): Promise<FeatureGroupMembership> {
    const existing = await db
      .select()
      .from(featureGroupMemberships)
      .where(and(eq(featureGroupMemberships.userId, data.userId), eq(featureGroupMemberships.groupId, data.groupId)));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [membership] = await db.insert(featureGroupMemberships).values(data).returning();
    return membership;
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    await db
      .delete(featureGroupMemberships)
      .where(and(eq(featureGroupMemberships.userId, userId), eq(featureGroupMemberships.groupId, groupId)));
  }

  async addUsersToGroup(userIds: string[], groupId: string, addedBy?: string): Promise<number> {
    let added = 0;
    for (const userId of userIds) {
      const existing = await db
        .select()
        .from(featureGroupMemberships)
        .where(and(eq(featureGroupMemberships.userId, userId), eq(featureGroupMemberships.groupId, groupId)));
      
      if (existing.length === 0) {
        await db.insert(featureGroupMemberships).values({ userId, groupId, addedBy });
        added++;
      }
    }
    return added;
  }

  async removeUsersFromGroup(userIds: string[], groupId: string): Promise<number> {
    if (userIds.length === 0) return 0;
    
    const result = await db
      .delete(featureGroupMemberships)
      .where(and(eq(featureGroupMemberships.groupId, groupId), inArray(featureGroupMemberships.userId, userIds)));
    
    return userIds.length;
  }

  async removeAllUsersFromGroup(groupId: string): Promise<void> {
    await db.delete(featureGroupMemberships).where(eq(featureGroupMemberships.groupId, groupId));
  }

  // ============================================
  // USER OVERRIDES
  // ============================================

  async getUserOverrides(userId: string): Promise<UserFeatureOverride[]> {
    return db.select().from(userFeatureOverrides).where(eq(userFeatureOverrides.userId, userId));
  }

  async setUserOverride(data: InsertUserFeatureOverride): Promise<UserFeatureOverride> {
    const existing = await db
      .select()
      .from(userFeatureOverrides)
      .where(and(eq(userFeatureOverrides.userId, data.userId), eq(userFeatureOverrides.flagKey, data.flagKey)));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(userFeatureOverrides)
        .set({ enabled: data.enabled, reason: data.reason, expiresAt: data.expiresAt })
        .where(eq(userFeatureOverrides.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [override] = await db.insert(userFeatureOverrides).values(data).returning();
    return override;
  }

  async removeUserOverride(userId: string, flagKey: string): Promise<void> {
    await db
      .delete(userFeatureOverrides)
      .where(and(eq(userFeatureOverrides.userId, userId), eq(userFeatureOverrides.flagKey, flagKey)));
  }

  // ============================================
  // FLAG RESOLUTION (Core Logic)
  // ============================================

  async resolveFlags(userId: string): Promise<ResolvedFeatureFlags> {
    const resolved: ResolvedFeatureFlags = {};

    const allFlags = await this.getAllFlags();
    const userOverrides = await this.getUserOverrides(userId);
    const userGroups = await this.getUserGroups(userId);

    const groupFlagsMap = new Map<string, { enabled: boolean; groupName: string }>();
    for (const group of userGroups) {
      const groupFlags = await this.getGroupFlags(group.id);
      for (const gf of groupFlags) {
        if (!groupFlagsMap.has(gf.flagKey) || gf.enabled) {
          groupFlagsMap.set(gf.flagKey, { enabled: gf.enabled, groupName: group.name });
        }
      }
    }

    const overrideMap = new Map<string, { enabled: boolean; expiresAt: Date | null }>();
    for (const override of userOverrides) {
      if (!override.expiresAt || override.expiresAt > new Date()) {
        overrideMap.set(override.flagKey, { enabled: override.enabled, expiresAt: override.expiresAt });
      }
    }

    for (const flag of allFlags) {
      const override = overrideMap.get(flag.key);
      if (override) {
        resolved[flag.key] = {
          enabled: override.enabled,
          source: 'override',
        };
        continue;
      }

      const groupFlag = groupFlagsMap.get(flag.key);
      if (groupFlag) {
        resolved[flag.key] = {
          enabled: groupFlag.enabled,
          source: 'group',
          groupName: groupFlag.groupName,
        };
        continue;
      }

      resolved[flag.key] = {
        enabled: flag.defaultEnabled ?? false,
        source: 'default',
      };
    }

    return resolved;
  }

  async isEnabled(userId: string, flagKey: string): Promise<boolean> {
    const flags = await this.resolveFlags(userId);
    return flags[flagKey]?.enabled ?? false;
  }

  // ============================================
  // BULK USER OPERATIONS
  // ============================================

  async getAllUsers(): Promise<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]> {
    return db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users);
  }

  async addAllUsersToGroup(groupId: string, addedBy?: string): Promise<number> {
    const allUsers = await this.getAllUsers();
    return this.addUsersToGroup(allUsers.map((u) => u.id), groupId, addedBy);
  }
}

export const featureFlagService = new FeatureFlagService();
