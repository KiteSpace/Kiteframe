import { db } from "./db";
import { aiUsageEvents, type AiFeature, type InsertAiUsageEvent } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

// Model multipliers per spec (stored as percentage: 100 = 1.0x)
// Base multiplier is 1.0x for all models as per Beta spec
// (Cost differentiation is tracked separately, not in units)
const MODEL_MULTIPLIERS: Record<string, number> = {
  'claude-3-haiku-20240307': 100,  // 1.0x (base)
  'claude-3-haiku-20240307': 100,   // 1.0x (same unit cost for Beta)
  'claude-3-haiku-20240307': 100,    // 1.0x (same unit cost for Beta)
};

// Vision multipliers per spec
const VISION_MULTIPLIER = 150; // 1.5x for vision requests
const MULTI_FRAME_MULTIPLIER = 200; // 2.0x for multi-frame vision

// Tokens per unit
const TOKENS_PER_UNIT = 500;

// Cost estimates in microdollars per 1000 tokens (input/output average)
const COST_PER_1K_TOKENS: Record<string, number> = {
  'claude-3-haiku-20240307': 9000,   // ~$0.009 per 1K tokens (average in/out)
  'claude-3-haiku-20240307': 750,     // ~$0.00075 per 1K tokens
  'claude-3-haiku-20240307': 45000,    // ~$0.045 per 1K tokens
};

export interface UsageLogParams {
  userId?: string;
  projectId?: string;
  workflowId?: string;
  feature: AiFeature;
  model: string;
  promptTokens: number;
  completionTokens: number;
  isVision?: boolean;
  isMultiFrame?: boolean;
}

export function calculateUnits(totalTokens: number): number {
  return Math.ceil(totalTokens / TOKENS_PER_UNIT);
}

export function getMultiplier(model: string, isVision: boolean, isMultiFrame: boolean): number {
  let multiplier = MODEL_MULTIPLIERS[model] || 100;
  
  if (isMultiFrame) {
    multiplier = Math.ceil(multiplier * MULTI_FRAME_MULTIPLIER / 100);
  } else if (isVision) {
    multiplier = Math.ceil(multiplier * VISION_MULTIPLIER / 100);
  }
  
  return multiplier;
}

export function calculateFinalUnits(baseUnits: number, multiplier: number): number {
  return Math.ceil(baseUnits * multiplier / 100);
}

export function estimateCostMicrodollars(totalTokens: number, model: string): number {
  const costPer1K = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['claude-3-haiku-20240307'];
  return Math.ceil((totalTokens / 1000) * costPer1K);
}

export async function logAiUsage(params: UsageLogParams): Promise<void> {
  const totalTokens = params.promptTokens + params.completionTokens;
  const baseUnits = calculateUnits(totalTokens);
  const multiplier = getMultiplier(params.model, params.isVision || false, params.isMultiFrame || false);
  const finalUnits = calculateFinalUnits(baseUnits, multiplier);
  const costEstimate = estimateCostMicrodollars(totalTokens, params.model);

  const event: InsertAiUsageEvent = {
    userId: params.userId || null,
    projectId: params.projectId || null,
    workflowId: params.workflowId || null,
    feature: params.feature,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens,
    units: baseUnits,
    multiplier,
    finalUnits,
    costEstimateUSD: costEstimate,
    isVision: params.isVision || false,
  };

  try {
    await db.insert(aiUsageEvents).values(event);
  } catch (error) {
    console.error('Failed to log AI usage:', error);
  }
}

// Aggregation queries
export interface UsageSummary {
  totalUnits: number;
  totalFinalUnits: number;
  periodUnits: number;
  avgDailyUnits: number;
  topFeature: string | null;
  firstUsage: Date | null;
  lastUsage: Date | null;
  featureBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}

export async function getUserUsageSummary(
  userId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<UsageSummary> {
  const now = new Date();
  const defaultPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
  
  const start = periodStart || defaultPeriodStart;
  const end = periodEnd || now;

  // Get all events for total
  const allEvents = await db.select()
    .from(aiUsageEvents)
    .where(eq(aiUsageEvents.userId, userId))
    .orderBy(aiUsageEvents.createdAt);

  // Get events for period
  const periodEvents = await db.select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, start),
        lte(aiUsageEvents.createdAt, end)
      )
    );

  // Calculate totals
  const totalUnits = allEvents.reduce((sum, e) => sum + (e.units || 0), 0);
  const totalFinalUnits = allEvents.reduce((sum, e) => sum + (e.finalUnits || 0), 0);
  const periodUnits = periodEvents.reduce((sum, e) => sum + (e.finalUnits || 0), 0);

  // Calculate feature breakdown
  const featureBreakdown: Record<string, number> = {};
  for (const event of allEvents) {
    featureBreakdown[event.feature] = (featureBreakdown[event.feature] || 0) + (event.finalUnits || 0);
  }

  // Calculate model breakdown
  const modelBreakdown: Record<string, number> = {};
  for (const event of allEvents) {
    modelBreakdown[event.model] = (modelBreakdown[event.model] || 0) + (event.finalUnits || 0);
  }

  // Find top feature
  let topFeature: string | null = null;
  let maxUsage = 0;
  for (const [feature, usage] of Object.entries(featureBreakdown)) {
    if (usage > maxUsage) {
      maxUsage = usage;
      topFeature = feature;
    }
  }

  // Calculate avg daily units
  const daysSinceFirst = allEvents.length > 0
    ? Math.max(1, Math.ceil((now.getTime() - new Date(allEvents[0].createdAt!).getTime()) / (24 * 60 * 60 * 1000)))
    : 1;
  const avgDailyUnits = Math.round(totalFinalUnits / daysSinceFirst);

  return {
    totalUnits,
    totalFinalUnits,
    periodUnits,
    avgDailyUnits,
    topFeature,
    firstUsage: allEvents.length > 0 ? new Date(allEvents[0].createdAt!) : null,
    lastUsage: allEvents.length > 0 ? new Date(allEvents[allEvents.length - 1].createdAt!) : null,
    featureBreakdown,
    modelBreakdown,
  };
}

export interface TimeSeriesPoint {
  timestamp: string;
  units: number;
  breakdown: Record<string, number>;
}

type TimeBucket = 'hour' | 'day' | 'week';

export async function getUserUsageTimeSeries(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  bucket: TimeBucket = 'day',
  features?: string[],
  models?: string[],
  visionOnly?: boolean
): Promise<TimeSeriesPoint[]> {
  let query = db.select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, periodStart),
        lte(aiUsageEvents.createdAt, periodEnd)
      )
    )
    .orderBy(aiUsageEvents.createdAt);

  const events = await query;

  // Filter by features/models/vision if specified
  let filtered = events;
  if (features && features.length > 0) {
    filtered = filtered.filter(e => features.includes(e.feature));
  }
  if (models && models.length > 0) {
    filtered = filtered.filter(e => models.includes(e.model));
  }
  if (visionOnly) {
    filtered = filtered.filter(e => e.isVision);
  }

  // Group by bucket
  const buckets = new Map<string, { units: number; breakdown: Record<string, number> }>();

  for (const event of filtered) {
    const date = new Date(event.createdAt!);
    let key: string;

    if (bucket === 'hour') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
    } else if (bucket === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { units: 0, breakdown: {} });
    }

    const bucketData = buckets.get(key)!;
    bucketData.units += event.finalUnits || 0;
    bucketData.breakdown[event.feature] = (bucketData.breakdown[event.feature] || 0) + (event.finalUnits || 0);
  }

  // Convert to array and sort
  return Array.from(buckets.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      units: data.units,
      breakdown: data.breakdown,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export interface UsageEvent {
  id: string;
  feature: string;
  model: string;
  units: number;
  projectId: string | null;
  workflowId: string | null;
  createdAt: Date;
  promptTokens?: number;
  completionTokens?: number;
  isVision?: boolean;
}

export async function getUserUsageEvents(
  userId: string,
  limit: number = 25,
  offset: number = 0,
  periodStart?: Date,
  periodEnd?: Date
): Promise<{ events: UsageEvent[]; total: number }> {
  const conditions = [eq(aiUsageEvents.userId, userId)];
  
  if (periodStart) {
    conditions.push(gte(aiUsageEvents.createdAt, periodStart));
  }
  if (periodEnd) {
    conditions.push(lte(aiUsageEvents.createdAt, periodEnd));
  }

  const events = await db.select()
    .from(aiUsageEvents)
    .where(and(...conditions))
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(aiUsageEvents)
    .where(and(...conditions));

  return {
    events: events.map(e => ({
      id: e.id,
      feature: e.feature,
      model: e.model,
      units: e.finalUnits || 0,
      projectId: e.projectId,
      workflowId: e.workflowId,
      createdAt: new Date(e.createdAt!),
      promptTokens: e.promptTokens || undefined,
      completionTokens: e.completionTokens || undefined,
      isVision: e.isVision || undefined,
    })),
    total: Number(countResult[0]?.count || 0),
  };
}

// ============= SYSTEM-WIDE AGGREGATIONS (ADMIN) =============

export async function getSystemUsageSummary(
  periodStart?: Date,
  periodEnd?: Date
): Promise<UsageSummary> {
  const now = new Date();
  const defaultPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const start = periodStart || defaultPeriodStart;
  const end = periodEnd || now;

  // Get all events
  const allEvents = await db.select()
    .from(aiUsageEvents)
    .orderBy(aiUsageEvents.createdAt);

  // Get events for period
  const periodEvents = await db.select()
    .from(aiUsageEvents)
    .where(
      and(
        gte(aiUsageEvents.createdAt, start),
        lte(aiUsageEvents.createdAt, end)
      )
    );

  // Calculate totals
  const totalUnits = allEvents.reduce((sum, e) => sum + (e.units || 0), 0);
  const totalFinalUnits = allEvents.reduce((sum, e) => sum + (e.finalUnits || 0), 0);
  const periodUnits = periodEvents.reduce((sum, e) => sum + (e.finalUnits || 0), 0);

  // Calculate feature breakdown
  const featureBreakdown: Record<string, number> = {};
  for (const event of allEvents) {
    featureBreakdown[event.feature] = (featureBreakdown[event.feature] || 0) + (event.finalUnits || 0);
  }

  // Calculate model breakdown
  const modelBreakdown: Record<string, number> = {};
  for (const event of allEvents) {
    modelBreakdown[event.model] = (modelBreakdown[event.model] || 0) + (event.finalUnits || 0);
  }

  // Find top feature
  let topFeature: string | null = null;
  let maxUsage = 0;
  for (const [feature, usage] of Object.entries(featureBreakdown)) {
    if (usage > maxUsage) {
      maxUsage = usage;
      topFeature = feature;
    }
  }

  // Calculate avg daily units
  const daysSinceFirst = allEvents.length > 0
    ? Math.max(1, Math.ceil((now.getTime() - new Date(allEvents[0].createdAt!).getTime()) / (24 * 60 * 60 * 1000)))
    : 1;
  const avgDailyUnits = Math.round(totalFinalUnits / daysSinceFirst);

  return {
    totalUnits,
    totalFinalUnits,
    periodUnits,
    avgDailyUnits,
    topFeature,
    firstUsage: allEvents.length > 0 ? new Date(allEvents[0].createdAt!) : null,
    lastUsage: allEvents.length > 0 ? new Date(allEvents[allEvents.length - 1].createdAt!) : null,
    featureBreakdown,
    modelBreakdown,
  };
}

export async function getSystemUsageTimeSeries(
  periodStart: Date,
  periodEnd: Date,
  bucket: 'hour' | 'day' | 'week' = 'day',
  visionOnly: boolean = false
): Promise<TimeSeriesPoint[]> {
  const events = await db.select()
    .from(aiUsageEvents)
    .where(
      and(
        gte(aiUsageEvents.createdAt, periodStart),
        lte(aiUsageEvents.createdAt, periodEnd)
      )
    )
    .orderBy(aiUsageEvents.createdAt);

  // Filter for vision if requested
  const filtered = visionOnly ? events.filter(e => e.isVision) : events;

  // Aggregate by bucket
  const buckets = new Map<string, { units: number; breakdown: Record<string, number> }>();

  for (const event of filtered) {
    const date = new Date(event.createdAt!);
    let key: string;

    if (bucket === 'hour') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
    } else if (bucket === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { units: 0, breakdown: {} });
    }

    const bucketData = buckets.get(key)!;
    bucketData.units += event.finalUnits || 0;
    bucketData.breakdown[event.feature] = (bucketData.breakdown[event.feature] || 0) + (event.finalUnits || 0);
  }

  return Array.from(buckets.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      units: data.units,
      breakdown: data.breakdown,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getSystemUsageEvents(
  limit: number = 25,
  offset: number = 0,
  periodStart?: Date,
  periodEnd?: Date
): Promise<{ events: UsageEvent[]; total: number }> {
  const conditions: any[] = [];
  
  if (periodStart) {
    conditions.push(gte(aiUsageEvents.createdAt, periodStart));
  }
  if (periodEnd) {
    conditions.push(lte(aiUsageEvents.createdAt, periodEnd));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const events = await db.select()
    .from(aiUsageEvents)
    .where(whereClause)
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(aiUsageEvents)
    .where(whereClause);

  return {
    events: events.map(e => ({
      id: e.id,
      feature: e.feature,
      model: e.model,
      units: e.finalUnits || 0,
      projectId: e.projectId,
      workflowId: e.workflowId,
      createdAt: new Date(e.createdAt!),
      promptTokens: e.promptTokens || undefined,
      completionTokens: e.completionTokens || undefined,
      isVision: e.isVision || undefined,
    })),
    total: Number(countResult[0]?.count || 0),
  };
}
