import type { Request } from "express";
import { db } from "../db";
import { adminAuditLogs } from "../../shared/schema";

export type AdminAction = 
  | 'admin_login'
  | 'admin_login_failed'
  | 'beta_grant'
  | 'beta_revoke'
  | 'waitlist_reject'
  | 'code_generate'
  | 'code_revoke'
  | 'user_group_create'
  | 'user_group_update'
  | 'user_group_delete'
  | 'user_add_to_group'
  | 'user_remove_from_group'
  | 'credits_adjust'
  | 'ban'
  | 'unban'
  | 'ban_delete';

interface AuditLogEntry {
  action: AdminAction;
  adminIdentifier: string;
  targetId?: string;
  targetType?: 'user' | 'code' | 'group';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      id: crypto.randomUUID(),
      action: entry.action,
      adminIdentifier: entry.adminIdentifier,
      targetId: entry.targetId || null,
      targetType: entry.targetType || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export function getRequestContext(req: Request): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}

export async function logAdminLogin(req: Request, success: boolean, username: string): Promise<void> {
  const ctx = getRequestContext(req);
  const sanitizedUsername = success ? username : `unverified:${(username || 'unknown').slice(0, 50)}`;
  await logAdminAction({
    action: success ? 'admin_login' : 'admin_login_failed',
    adminIdentifier: sanitizedUsername,
    details: { success, attemptedUsername: success ? undefined : username },
    ...ctx,
  });
}

export async function logBetaAction(
  req: Request, 
  action: 'beta_grant' | 'beta_revoke' | 'waitlist_reject', 
  userId: string, 
  userEmail?: string
): Promise<void> {
  const ctx = getRequestContext(req);
  const adminUser = (req as any).adminUser || 'admin';
  await logAdminAction({
    action,
    adminIdentifier: adminUser,
    targetId: userId,
    targetType: 'user',
    details: { email: userEmail },
    ...ctx,
  });
}

export async function logCodeAction(
  req: Request,
  action: 'code_generate' | 'code_revoke',
  codeId: string,
  details?: Record<string, unknown>
): Promise<void> {
  const ctx = getRequestContext(req);
  const adminUser = (req as any).adminUser || 'admin';
  await logAdminAction({
    action,
    adminIdentifier: adminUser,
    targetId: codeId,
    targetType: 'code',
    details,
    ...ctx,
  });
}

export async function logBanAction(
  req: Request,
  action: 'ban' | 'unban' | 'ban_delete',
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  const ctx = getRequestContext(req);
  const adminUser = (req as any).adminUser || 'admin';
  await logAdminAction({
    action,
    adminIdentifier: adminUser,
    targetId,
    targetType: 'user',
    details,
    ...ctx,
  });
}
