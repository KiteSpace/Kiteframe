/**
 * Phase 5: Structural Change Timeline
 * 
 * Tracks Accept/Undo/Redo events with timestamps.
 * Internal data structure - UI exposure is optional and minimal.
 */

import type { TimelineEvent, TimelineEventType, DecisionSnapshot } from './types';

let eventIdCounter = 0;

function generateEventId(): string {
  return `timeline_${Date.now()}_${++eventIdCounter}`;
}

/**
 * In-memory timeline storage
 * This is session-scoped and resets on reload
 */
let timeline: TimelineEvent[] = [];

/**
 * Get the current timeline (read-only copy)
 */
export function getTimeline(): readonly TimelineEvent[] {
  return [...timeline];
}

/**
 * Clear the timeline (for testing or session reset)
 */
export function clearTimeline(): void {
  timeline = [];
}

/**
 * Record a proposal accept event
 */
export function recordProposalAccept(
  snapshot: DecisionSnapshot
): TimelineEvent {
  const event: TimelineEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    eventType: 'accept_proposal',
    decisionSnapshotId: snapshot.id,
    insightId: snapshot.insightId,
    insightTitle: snapshot.insightTitle,
    nodeIds: snapshot.createdNodeIds,
    edgeIds: snapshot.createdEdgeIds,
  };
  
  timeline.push(event);
  return event;
}

/**
 * Record an experiment accept event
 */
export function recordExperimentAccept(
  snapshot: DecisionSnapshot
): TimelineEvent {
  const event: TimelineEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    eventType: 'accept_experiment',
    decisionSnapshotId: snapshot.id,
    insightId: snapshot.insightId,
    insightTitle: snapshot.insightTitle,
    nodeIds: snapshot.createdNodeIds,
    edgeIds: snapshot.createdEdgeIds,
  };
  
  timeline.push(event);
  return event;
}

/**
 * Record an undo event
 */
export function recordUndo(
  undoneEventId: string,
  nodeIds: string[],
  edgeIds: string[]
): TimelineEvent {
  const event: TimelineEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    eventType: 'undo',
    undoneEventId,
    nodeIds,
    edgeIds,
  };
  
  timeline.push(event);
  return event;
}

/**
 * Record a redo event
 */
export function recordRedo(
  redoneEventId: string,
  nodeIds: string[],
  edgeIds: string[]
): TimelineEvent {
  const event: TimelineEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    eventType: 'redo',
    undoneEventId: redoneEventId,
    nodeIds,
    edgeIds,
  };
  
  timeline.push(event);
  return event;
}

/**
 * Get timeline events filtered by type
 */
export function getTimelineByType(eventType: TimelineEventType): TimelineEvent[] {
  return timeline.filter(e => e.eventType === eventType);
}

/**
 * Get timeline events for a specific insight
 */
export function getTimelineForInsight(insightId: string): TimelineEvent[] {
  return timeline.filter(e => e.insightId === insightId);
}
