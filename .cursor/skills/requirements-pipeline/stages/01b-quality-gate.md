# Stage 1b: Quality Gate

> Runs immediately after `01a-scoping.md`. Determines current state, input quality, and provisional mode before Stage 2.

---

## Step 1: Current State Discovery

Ask the PM:
- "Is this a new feature (greenfield) or an enhancement to something that already exists?"
- If enhancement: "What does the current experience look like? Provide existing screens, capabilities, or known limitations — Figma link, screenshot, or description."

**If current state is provided:** Process Figma links or screenshots through `design-to-context`. Assign `SRC-CS-1` and save to `source_summaries/`.

**If not provided:** Record `[CURRENT STATE UNKNOWN — do not assume what exists today]`. Carry this flag to Stage 2. Do not invent current capabilities, pain points, or before/after framing.

This field is mandatory in the Stage 1 artifact. It must be either `CONFIRMED` (with source) or `[CURRENT STATE UNKNOWN]`.

## Step 2: Input Quality Assessment

Assess whether inputs are sufficient to produce reliable requirements.

| Context | Required in | Coverage |
|---|---|---|
| Business (goals, success metrics, constraints) | All modes | [Covered: SRC-N / Not covered] |
| Product (scope, rules, edge cases) | All modes | [Covered: SRC-N / Not covered] |
| UX (flows, screens, design intent) | Standard, Full | [Covered: SRC-N / Not covered / N/A: Express] |
| Persona (who uses it, goals, pain points) | Full | [Covered: SRC-N / Not covered / N/A: Express/Standard] |
| Technical (systems, integrations, constraints) | Full | [Covered: SRC-N / Not covered / N/A: Express/Standard] |
| Compliance (regulatory, legal, security) | Full when applicable | [Covered / Not applicable / Not covered] |

| Rating | Criteria |
|---|---|
| **HIGH** | All required contexts for the likely mode are covered by Tier 1 inputs. Gaps are minor edge cases. |
| **MEDIUM** | Core contexts (Business, Product) covered. UX or Technical is thin. Some FRs will carry `[TBD]`. |
| **LOW** | Business or Product context is absent. Key requirements will be inferred without sourcing. |

**If LOW:** Present this to the PM before proceeding:
> "Inputs are thin on [missing context]. Proceeding will produce a document where significant content is inferred. Options: (1) Provide additional inputs now, (2) Proceed and accept LOW confidence output, (3) Switch to Express mode."
Do not proceed until the PM acknowledges. Record PM's choice in the state file: `quality_rating → "LOW"` and `low_quality_acknowledged → true`.

## Step 3: Provisional Mode Suggestion

Apply these signals, then present the recommendation to the PM for confirmation or override:

**Suggest Express if ALL are true:**
- Source documents: 1–2 (excluding `project-context.md`)
- Distinct actors: 1
- New external system integration: No
- Current state: simple change or greenfield

**Suggest Full if ANY is true:**
- New external system integration required
- 4 or more distinct actors
- Compliance or legal inputs present
- Complex multi-path current state

**Otherwise: suggest Standard.**

Present to PM:
```
Suggested mode: [Express / Standard / Full]
Reason: [one sentence — which signals drove this]

Confirm this mode, or override:
  A) Express — lean document; Stages 4 and 6 skipped after Stage 3.5
  B) Standard — full analysis, all stages
  C) Full — full analysis + compliance, persona depth, technical constraints

This is provisional. All runs follow the same path through Stage 3.5.
Stage 4 and 6 skips (Express only) are applied after Stage 3.5 confirms the mode.
```

Record the confirmed provisional mode in the state file.

## Step 4: Save Stage 1b Artifact

**Path:** `_runs/[run-name]/stage_output/Stage1b-Quality-Gate.md`

Summary Card:
```
## Summary Card — Stage 1: Intake
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]
**Input Quality:** [HIGH / MEDIUM / LOW]
**Current State:** [CONFIRMED (SRC-N) / CURRENT STATE UNKNOWN]

**Inputs processed:** [N total] — [list: SRC-N: filename/type, one per line]

**Context:** [One sentence — greenfield vs. redesign, what this run produces]

**PM review needed before Stage 2:**
- [ ] [Any unprocessed inputs — or "All inputs processed"]
- [ ] [LOW quality: confirm path forward — or "Quality is HIGH/MEDIUM — proceed"]
```

Include below the card: source registry, current state summary, quality assessment table, confirmed mode with skip list (if Express).

## Step 5: Initialize State File

Write `_runs/[run-name]/.meta/pipeline-state.json` using the full schema defined in SKILL.md. Set these fields from Stage 1 values:

```json
{
  "run_id": "[YYYYMMDD]-[feature-slug]",
  "feature": "[confirmed feature name]",
  "pipeline_mode": "[Express | Standard | Full]",
  "current_task": "stage1b",
  "stages_completed": ["stage1a", "stage1b"],
  "artifacts": { "stage1b": "[path to Stage1b-Quality-Gate.md]" },
  "quality_rating": "[HIGH / MEDIUM / LOW]",
  "low_quality_acknowledged": false,
  "source_ids": ["SRC-1", "SRC-2", "..."],
  "last_updated_utc": "[ISO 8601 timestamp]"
}
```

All other schema fields: use defaults from SKILL.md (gates_passed all false, remaining artifacts null, split_features empty).

## Checkpoint — Chat Output

Present at most 10 lines:
```
Stage 1 complete. File: [path]

Inputs: [N] | Quality: [HIGH/MEDIUM/LOW] | Current state: [CONFIRMED / UNKNOWN]
Mode: [Express / Standard / Full] — [one-sentence reason]

Review the file and confirm mode to proceed to Stage 2.
```