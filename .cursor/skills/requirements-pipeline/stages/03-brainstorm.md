# Stage 3: Brainstorm — Variables, Constraints, Actors

> **Stage boundary:** Stage 2 extracts what the sources say. Stage 3 analyzes what the sources do not say. Never restate Stage 2 content — reference it and build on it.

---

## Step 0: Anti-Restate Table (write this first in the artifact)

Before any analysis, write this table as the first content in the Stage 3 artifact:

| Stage 2 content | Stage 3 builds on it by... | Stage 3 will NOT... |
|---|---|---|
| Actors | Mapping interactions: who triggers whom, data flow, failure modes | Re-describe actor roles |
| Constraints | Finding hidden constraints no source mentioned | Repeating Stage 2 constraints |
| STATED facts | Gap-finding: what the sources are silent on | Re-extracting confirmed facts |

If you find yourself copying Stage 2 content into Stage 3 output, stop. Reference it (`See Stage 2, [item]`) and add only what is new.

**Do not write any Step 1 content until this table is written and complete in this artifact. If you find yourself writing variables, constraints, or questions before this table exists, stop and write it first.**

## Step 1: Variables Table

Identify the variables that determine system behavior. Source each from Stage 2 confirmed content only.

| Variable | Values / Range | Source (SRC-N) | Determines |
|---|---|---|---|
| [Variable] | [Possible values] | [SRC-N] | [What behavior it affects] |

## Step 2: Five-Lens Gap Analysis

Apply each lens in sequence. Each lens must produce at least one question — a lens that produces zero questions was not applied seriously.

**Lens 1 — Actor-state combinations:** For each actor from Stage 2: what if they are absent? In a transitional state? Acting unexpectedly (force-close, non-response, duplicate action)?

**Lens 2 — Boundary conditions:** For each variable: what happens at minimum, maximum, zero, and threshold edges? What if the value is null, missing, or invalid?

**Lens 3 — Sequence disruptions:** Walk the happy path: what if a step is skipped? Out of order? Happens twice? Has an abnormal time gap between steps?

**Lens 4 — System failures:** For each external dependency: what if it is down? Returns stale or wrong data? Is slow? Loses data in transit?

**Lens 5 — Constraint collisions:** For each pair of constraints from Stage 2: can both be satisfied simultaneously? If they conflict, which takes priority?

## Step 3: New Constraints

From the lens findings, identify constraints no source mentioned. Before writing any constraint, complete this dedup check in the artifact:

| Proposed constraint | In Stage 2 already? | Action |
|---|---|---|
| [One line] | Yes — Stage 2 C-N | Reference only — do NOT add to Stage 3 |
| [One line] | No — genuinely new | Add to NC table below |

New constraints only (no Stage 2 repeats):

| # | New Constraint | Category | Discovered Via | Impact |
|---|---|---|---|---|
| NC1 | [Constraint] | Technical / Regulatory / Operational / UX | Lens N | [What it prevents or requires] |

## Step 4: Actor Interaction Map

Stage 2 listed actors. Stage 3 maps how they interact:

| Trigger | From | To | Data Exchanged | Failure Mode |
|---|---|---|---|---|
| [Event] | [Actor A] | [Actor B] | [What flows] | [What fails] |

## Step 5: Brainstorm Questions

List all questions the gap analysis surfaced:
```
Questions for PM:
1. [Question] — affects: [variable or constraint]
2. [Question] — affects: [variable or constraint]
```

## Save Stage 3 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage3-Brainstorm.md`

Summary Card:
```
## Summary Card — Stage 3: Brainstorm
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3 findings:**
1. [Most important new variable or edge case]
2. [Most critical new constraint]
3. [Most significant actor interaction failure mode]

**New vs. Stage 2:** [One sentence — net-new constraints added, Stage 2 items referenced not restated]

**PM review needed before Stage 3.5:**
- [ ] [Gap question that needs PM input — stated as complete sentence]
```

Include below the card: anti-restate table, variables table, lens findings (questions per lens), constraint dedup check, NC table, actor interaction map.

## Checkpoint — Chat Output

Present at most 10 lines:
```
Stage 3 complete. File: [path]

Found: [N] variables | [N] new constraints (NC1–NC[N]) | [N] actor interactions
Questions for PM: [N] — listed at end of file

Review the file and confirm to proceed to Stage 3.5, or answer the questions above.
```

## State File Update

- `current_task` → `"stage3"`
- `stages_completed` → add `"stage3"`
- `artifacts.stage3` → file path