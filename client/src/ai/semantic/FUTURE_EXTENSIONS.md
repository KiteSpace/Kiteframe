# Phase 6E: Future Extensions

This document describes potential future extensions to the Semantic Completeness system.
**These are NOT implemented** - they are documented for future consideration only.

## Counter Node Abstraction

### Concept
A specialized node type that tracks count-based state:
- Initial value
- Increment/decrement triggers
- Threshold conditions

### Use Cases
- Retry counters
- Failure counts
- Usage quotas

### Why Not Implemented Yet
- Requires new node type in schema
- UI complexity for node configuration
- Migration concerns for existing workflows

### Future Implementation Notes
```typescript
interface CounterNodeData {
  initialValue: number;
  maxValue?: number;
  minValue?: number;
  onThresholdExceeded?: 'escalate' | 'terminate' | 'reset';
}
```

---

## Timer Node Abstraction

### Concept
A specialized node type that tracks time-based state:
- Start time tracking
- Duration thresholds
- Timeout conditions

### Use Cases
- Time-based escalation
- SLA monitoring
- Session timeouts

### Why Not Implemented Yet
- Requires execution runtime understanding
- Complexity of "paused" vs "running" states
- Integration with external scheduling systems

### Future Implementation Notes
```typescript
interface TimerNodeData {
  durationMs: number;
  startCondition: 'on_entry' | 'manual';
  onTimeout: 'escalate' | 'continue' | 'terminate';
}
```

---

## Auto-Suggested Fixes

### Concept
When a semantic mismatch is detected, the system could suggest specific structural additions:
- "Add a condition node to check retry count"
- "Add an escalation path for timeout"

### Why Not Implemented Yet
- Risk of over-automation
- User trust concerns
- Complexity of generating correct suggestions

### Design Principles (When Implemented)
1. Suggestions are **never** auto-applied
2. User must explicitly accept each suggestion
3. Suggestions are clearly marked as "AI-generated"
4. Full undo capability required

---

## Phase 7: Stateful Nodes

### Concept
A broader abstraction for nodes that maintain state across workflow executions:
- Counters
- Timers
- Accumulators
- State machines

### Why Deferred to Phase 7
- Requires significant schema changes
- UI/UX design work needed
- Execution model implications

### Prerequisites
- Phase 6 complete and stable
- User feedback on mismatch detection
- Clear use cases from production usage

---

## Non-Goals (Strict)

The following will **NOT** be implemented as part of the semantic completeness system:

1. **No Auto-Regeneration**
   - The system will never automatically regenerate workflows
   - User must explicitly request regeneration

2. **No Silent Edits**
   - The system will never modify workflows without user action
   - All changes require explicit acceptance

3. **No Inferred Thresholds**
   - The system will not guess numeric thresholds
   - Thresholds must be explicitly specified by the user

4. **No Breaking Phase 4 or Phase 5**
   - All existing heuristics remain advisory
   - All existing audit data remains accurate

---

## Migration Path

When future extensions are implemented:

1. **Feature Flags First**
   - All new features behind flags
   - Default OFF until stable

2. **Opt-In Adoption**
   - Users choose to enable new features
   - No forced migrations

3. **Backward Compatibility**
   - Existing workflows continue to work
   - No breaking changes to stored data

4. **Gradual Rollout**
   - Start with power users
   - Gather feedback before wider release
