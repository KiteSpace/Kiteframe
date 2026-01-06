import type { Express } from "express";
import { featureFlagService } from "./featureFlagService";
import { isAuthenticated } from "./replitAuth";
import { z } from "zod";

function isAdminUser(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

function getUserIdFromRequest(user: any): string {
  if (user?.claims?.sub) return user.claims.sub;
  if (user?.id) return user.id;
  throw new Error('Unable to extract user ID from request');
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const email = req.user?.claims?.email || req.user?.email;
  if (!isAdminUser(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function registerFeatureFlagRoutes(app: Express) {
  // ============================================
  // PUBLIC: Resolve flags for current user
  // ============================================

  app.get('/api/feature-flags', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const flags = await featureFlagService.resolveFlags(userId);
      res.json(flags);
    } catch (error) {
      console.error('Error resolving feature flags:', error);
      res.status(500).json({ error: 'Failed to resolve feature flags' });
    }
  });

  app.get('/api/feature-flags/:key', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const enabled = await featureFlagService.isEnabled(userId, req.params.key);
      res.json({ key: req.params.key, enabled });
    } catch (error) {
      console.error('Error checking feature flag:', error);
      res.status(500).json({ error: 'Failed to check feature flag' });
    }
  });

  // ============================================
  // ADMIN: Flag Management
  // ============================================

  app.get('/api/admin/feature-flags', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const flags = await featureFlagService.getAllFlags();
      res.json(flags);
    } catch (error) {
      console.error('Error fetching flags:', error);
      res.status(500).json({ error: 'Failed to fetch flags' });
    }
  });

  app.post('/api/admin/feature-flags', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().min(1),
        parentKey: z.string().optional().nullable(),
        status: z.enum(['disabled', 'beta', 'ga', 'deprecated']).optional(),
        defaultEnabled: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const flag = await featureFlagService.createFlag(data);
      res.json(flag);
    } catch (error) {
      console.error('Error creating flag:', error);
      res.status(500).json({ error: 'Failed to create flag' });
    }
  });

  app.patch('/api/admin/feature-flags/:key', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        category: z.string().min(1).optional(),
        parentKey: z.string().optional().nullable(),
        status: z.enum(['disabled', 'beta', 'ga', 'deprecated']).optional(),
        defaultEnabled: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const flag = await featureFlagService.updateFlag(req.params.key, data);
      if (!flag) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      res.json(flag);
    } catch (error) {
      console.error('Error updating flag:', error);
      res.status(500).json({ error: 'Failed to update flag' });
    }
  });

  app.delete('/api/admin/feature-flags/:key', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await featureFlagService.deleteFlag(req.params.key);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting flag:', error);
      res.status(500).json({ error: 'Failed to delete flag' });
    }
  });

  // ============================================
  // ADMIN: Group Management
  // ============================================

  app.get('/api/admin/feature-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const groups = await featureFlagService.getAllGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.post('/api/admin/feature-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
        isDefault: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const group = await featureFlagService.createGroup(data);
      res.json(group);
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  app.patch('/api/admin/feature-groups/:id', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        color: z.string().optional(),
        isDefault: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const group = await featureFlagService.updateGroup(req.params.id, data);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json(group);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).json({ error: 'Failed to update group' });
    }
  });

  app.delete('/api/admin/feature-groups/:id', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await featureFlagService.deleteGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ error: 'Failed to delete group' });
    }
  });

  // ============================================
  // ADMIN: Group-Flag Assignments
  // ============================================

  app.get('/api/admin/feature-groups/:id/flags', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const flags = await featureFlagService.getGroupFlags(req.params.id);
      res.json(flags);
    } catch (error) {
      console.error('Error fetching group flags:', error);
      res.status(500).json({ error: 'Failed to fetch group flags' });
    }
  });

  app.post('/api/admin/feature-groups/:id/flags', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        flagKey: z.string().min(1),
        enabled: z.boolean().default(true),
      });
      const data = schema.parse(req.body);
      const assignment = await featureFlagService.assignFlagToGroup({
        groupId: req.params.id,
        flagKey: data.flagKey,
        enabled: data.enabled,
      });
      res.json(assignment);
    } catch (error) {
      console.error('Error assigning flag to group:', error);
      res.status(500).json({ error: 'Failed to assign flag to group' });
    }
  });

  app.delete('/api/admin/feature-groups/:id/flags/:flagKey', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await featureFlagService.removeFlagFromGroup(req.params.id, req.params.flagKey);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing flag from group:', error);
      res.status(500).json({ error: 'Failed to remove flag from group' });
    }
  });

  // ============================================
  // ADMIN: Group Memberships
  // ============================================

  app.get('/api/admin/feature-groups/:id/members', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const members = await featureFlagService.getGroupMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error('Error fetching group members:', error);
      res.status(500).json({ error: 'Failed to fetch group members' });
    }
  });

  app.post('/api/admin/feature-groups/:id/members', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        userId: z.string().min(1),
      });
      const data = schema.parse(req.body);
      const adminId = getUserIdFromRequest(req.user);
      const membership = await featureFlagService.addUserToGroup({
        userId: data.userId,
        groupId: req.params.id,
        addedBy: adminId,
      });
      res.json(membership);
    } catch (error) {
      console.error('Error adding member to group:', error);
      res.status(500).json({ error: 'Failed to add member to group' });
    }
  });

  app.delete('/api/admin/feature-groups/:id/members/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await featureFlagService.removeUserFromGroup(req.params.userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing member from group:', error);
      res.status(500).json({ error: 'Failed to remove member from group' });
    }
  });

  // Batch operations
  app.post('/api/admin/feature-groups/:id/members/batch', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        userIds: z.array(z.string().min(1)),
        action: z.enum(['add', 'remove']),
      });
      const data = schema.parse(req.body);
      const adminId = getUserIdFromRequest(req.user);
      
      let count = 0;
      if (data.action === 'add') {
        count = await featureFlagService.addUsersToGroup(data.userIds, req.params.id, adminId);
      } else {
        count = await featureFlagService.removeUsersFromGroup(data.userIds, req.params.id);
      }
      res.json({ success: true, count });
    } catch (error) {
      console.error('Error batch updating members:', error);
      res.status(500).json({ error: 'Failed to batch update members' });
    }
  });

  app.post('/api/admin/feature-groups/:id/members/all', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        action: z.enum(['add', 'remove']),
      });
      const data = schema.parse(req.body);
      const adminId = getUserIdFromRequest(req.user);
      
      let count = 0;
      if (data.action === 'add') {
        count = await featureFlagService.addAllUsersToGroup(req.params.id, adminId);
      } else {
        await featureFlagService.removeAllUsersFromGroup(req.params.id);
        count = -1; // Indicates all removed
      }
      res.json({ success: true, count });
    } catch (error) {
      console.error('Error updating all members:', error);
      res.status(500).json({ error: 'Failed to update all members' });
    }
  });

  // ============================================
  // ADMIN: User Overrides
  // ============================================

  app.get('/api/admin/users/:userId/feature-overrides', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const overrides = await featureFlagService.getUserOverrides(req.params.userId);
      res.json(overrides);
    } catch (error) {
      console.error('Error fetching user overrides:', error);
      res.status(500).json({ error: 'Failed to fetch user overrides' });
    }
  });

  app.post('/api/admin/users/:userId/feature-overrides', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        flagKey: z.string().min(1),
        enabled: z.boolean(),
        reason: z.string().optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      });
      const data = schema.parse(req.body);
      const adminId = getUserIdFromRequest(req.user);
      const override = await featureFlagService.setUserOverride({
        userId: req.params.userId,
        flagKey: data.flagKey,
        enabled: data.enabled,
        reason: data.reason,
        createdBy: adminId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
      res.json(override);
    } catch (error) {
      console.error('Error setting user override:', error);
      res.status(500).json({ error: 'Failed to set user override' });
    }
  });

  app.delete('/api/admin/users/:userId/feature-overrides/:flagKey', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await featureFlagService.removeUserOverride(req.params.userId, req.params.flagKey);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing user override:', error);
      res.status(500).json({ error: 'Failed to remove user override' });
    }
  });

  // ============================================
  // ADMIN: Users list for membership management
  // ============================================

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await featureFlagService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/:userId/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const groups = await featureFlagService.getUserGroups(req.params.userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      res.status(500).json({ error: 'Failed to fetch user groups' });
    }
  });
}
