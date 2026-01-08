# KiteAI Mutation Reproduction Script

## Purpose
This QA script reproduces the observed mutation failure where KiteAI:
1. Appends a duplicate workflow instead of editing the existing one
2. Creates "Option A/B/C/D" edge labels via decision repair
3. Runs without guardrails due to FeatureFlagProvider wiring issues

## Prerequisites
- Load the baseline workflow from `/tests/fixtures/workflow_baseline.json`
- Open browser console to observe logging output
- Ensure no FeatureFlags warnings appear in console

## Reproduction Steps

### Step 1: Load Baseline Workflow
1. Open Kiteframe app at `/app`
2. Create a new project or open an existing one
3. Import or recreate the 12-node baseline workflow:
   - Opportunity Identification → Initial Assessment → Viable? (decision)
   - Yes branch: Research → Design → Design Approved? (decision)
   - Build → Test → Release → Complete
   - No branches lead to Archive or Revise Design

### Step 2: Ask for Guidance (ADVISE mode expected)
Send this message in the in-project chat:
```
I'm not sure what the next best step is for improving this workflow. 
What would you recommend?
```

**Expected Behavior:**
- KiteAI should respond with suggestions/analysis
- NO canvas mutations should occur
- Console should show: `[ChatMutation] Intent resolution:` with `isFullGraphPayload: false`

**Failure Indicator:**
- If canvas is modified, the ADVISE mode enforcement failed

### Step 3: Ask for Adjustments (Potential Mutation)
Send this follow-up message:
```
Can you make these suggested adjustments to the workflow?
```

**Expected Behavior (After Fix):**
- If in ADVISE mode (default): UI should prompt "Apply changes?" before modifying
- If user confirms Apply: Updates should modify existing nodes, not create duplicates
- Console should NOT show `isFullGraphPayload: true` if it's actually a patch
- No edges should have labels matching "Option A", "Option B", "Option C", "Option D"

**Failure Indicators:**
1. **Duplicate Workflow**: Node count increases by 10+ nodes (second canonical workflow appended)
2. **Option Labels**: Any edge has label matching `/^Option\s+[A-D]$/i`
3. **No Confirmation**: Full graph replacement happens without user confirmation
4. **FeatureFlags Warning**: Console shows "useFeatureFlags called outside of FeatureFlagProvider"

## Verification Checklist

### Console Checks
- [ ] No FeatureFlagProvider warnings
- [ ] `[ChatMutation] Intent resolution:` log shows correct signals
- [ ] `[MutationContract]` log shows MERGE/PATCH (not REPLACE without confirmation)
- [ ] `[WorkflowLifecycle]` log shows labelsAssigned without "Option X" values

### Canvas Checks
- [ ] Original 12 nodes remain (not duplicated)
- [ ] No parallel/disconnected workflow islands created
- [ ] All edges have meaningful labels (Yes/No, Pass/Fail, etc.) not "Option A/B/C/D"
- [ ] Changes are undoable in a single step

### UI Checks
- [ ] AI mode indicator shows current mode (Suggest/Apply/Generate)
- [ ] Full-graph replace triggers confirmation dialog
- [ ] Undo button successfully reverts the last mutation

## Test Data

### Baseline Workflow Stats
- **Nodes**: 12
- **Edges**: 12
- **Decision Nodes**: 2 (Viable?, Design Approved?)
- **Canonical Labels**: Opportunity Identification, Initial Assessment, Research Phase, Design Phase, Build, Test, Release, Complete

### Duplicate Detection Heuristics
A full-graph payload is detected if:
- Incoming nodes >= 8 OR >= 60% of existing nodes OR >= 10 nodes
- Incoming contains >= 3 duplicate canonical labels
- Incoming has linear chain resembling complete workflow

## Related Files
- `/tests/fixtures/workflow_baseline.json` - Baseline workflow data
- `/client/src/hooks/useChatMutation.ts` - Mutation entry point with logging
- `/client/src/workflow/mutation/applyChatWorkflowMutation.ts` - Mutation safety checks
- `/client/src/workflow/lifecycle/runWorkflowRepairs.ts` - Decision repair with label generation
- `/client/src/ai/repair/decisionRepair.ts` - Option A/B/C/D label source (to be fixed)
