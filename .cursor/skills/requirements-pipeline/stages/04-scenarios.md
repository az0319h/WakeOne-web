# Stage 4: Scenario Matrix

> **Skipped for Express mode.** If `pipeline_mode` in the state file is `Express`, stop here and proceed to Stage 5.

> **Scenario ID rule:** Scenario IDs (S-1, S-2, etc.) are internal to this stage's artifact only. They must never appear in FR bullets in Stage 7. Stage 7 reads Expected Behavior cells as design fact — not as traceable citations.

---

## Step 1: Build Scenario Matrix

Cross-reference variables from Stage 3 to identify all meaningful combinations:

| ID | [Variable 1] | [Variable 2] | Expected Behavior | Priority |
|---|---|---|---|---|
| S-1 | [value] | [value] | [Observable outcome — actor's perspective only] | Critical / Important / Edge |

**Rules:**
- Happy paths first, then boundary conditions, then error scenarios, then edge cases
- Sort by priority: Critical → Important → Edge
- Use Stage 3 lens findings (boundary conditions, sequence disruptions, failures, constraint collisions) as the primary input for edge cases — each lens finding should produce at least one row

**Expected Behavior cell — one cell, one job:** Describe the observable outcome only. No PM decisions, no design flags, no `[TBD]` entries.

❌ `capability check re-runs → toggle ON. Confirmed 2026-05-01. Design must specify nudge copy.`
✅ `capability check re-runs; if enrollment present → brief inline nudge shown; toggle stays OFF until officer taps it`

If a PM decision surfaces while building the matrix, record it in a **Gap Resolution Register** section at the end of the artifact — not in the Expected Behavior cell. Design dependencies that are unknown → carry as Open Questions to Stage 5.

## Step 2: Edge Case Review

For any variable not fully covered by Stage 3 lens findings, apply:
- What happens at the boundary? (exactly at threshold)
- What if this value is missing or null?
- What if two actors act simultaneously or in conflict?
- What if the process is interrupted midway?

## Step 3: Present for Review

Show the full matrix and ask:
- Any scenarios missing?
- Any edge cases seen in practice that are not listed?
- Which scenarios are highest priority?

## Save Stage 4 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage4-Scenarios.md`

Summary Card:
```
## Summary Card — Stage 4: Scenario Matrix
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3:**
1. [Most critical scenario]
2. [Most significant error or failure mode]
3. [Most surprising edge case]

**New vs. Stage 3:** [One sentence — scenario count, critical gaps found]

**PM review needed before Stage 5:**
- [ ] [Scenario with unknown expected behavior — as complete sentence, ID in parentheses]
```

Write each review item as a complete sentence. Scenario IDs go in parentheses at the end:
❌ `- [ ] S-4: What happens if the officer cancels mid-flow?`
✅ `- [ ] The expected behavior when an officer cancels mid-flow is undefined — confirm. (S-4)`

## Checkpoint — Chat Output

```
Stage 4 complete. File: [path]

Scenarios: [N] total — [N] Critical | [N] Important | [N] Edge
PM review items: [N] — listed in file

Review and confirm to proceed to Stage 5.
```

## State File Update

- `current_task` → `"stage4"`
- `stages_completed` → add `"stage4"`
- `artifacts.stage4` → file path