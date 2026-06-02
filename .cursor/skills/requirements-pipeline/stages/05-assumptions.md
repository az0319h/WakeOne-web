# Stage 5: Assumptions (MANDATORY CHECKPOINT)

> Gate stage. Do not proceed to Stage 6 (or Stage 7a if Express) until PM confirms HIGH assumptions.

---

## Position 0: Filters — Apply Before Surfacing Any Assumption

### Standard Practice Exclusion
Do NOT surface these as assumptions — they are Hard Constraints:
- WCAG accessibility compliance
- Default device language as the display language
- Platform-standard secure credential storage
- Standard authentication token lifecycle
- Default device orientation handling on mobile

If an item matches any of the above, flag it immediately as `[RECLASSIFY: Hard Constraint]` and exclude it from the assumptions list.

### Reclassification Filter
Before including any item in the assumptions list, apply this filter:

| If the item... | Then it is... | Action |
|---|---|---|
| Matches a known professional standard (see above) | Hard Constraint | `[RECLASSIFY: Hard Constraint]` — move to Section 9.1 |
| Has an owner and delivery status (someone must deliver something) | Dependency | `[RECLASSIFY: Dependency]` — move to Section 9.1 |
| Needs a stakeholder decision before proceeding | Open Question | `[RECLASSIFY: Open Question]` — move to Section 10 |
| Is confirmed and creates a trade-off | Known Limitation | `[RECLASSIFY: Known Limitation]` — move to Section 8 |
| Is confirmed and creates no trade-off | Not an assumption | Delete it |
| Is unconfirmed and carries risk if wrong | Assumption | Keep it |

> **DEP check:** Before reclassifying as Dependency — does the value already exist in current inputs, the codebase, or a prior conversation? If yes, look it up. A known value with no trade-off is deleted. A known value with a trade-off moves to Known Limitations.

Keep `[RECLASSIFY: ...]` tags in the Stage 5 artifact — they are the audit trail for why items were moved. Do not remove them.

> **OQ-over-KL precedence:** When an item matches both the "creates a trade-off" criterion (KL) AND the "needs a stakeholder decision" criterion (OQ), classify as OQ only. A pending decision means the trade-off has not been accepted — "confirmed trade-off" requires that the team has decided to ship with the constraint. Apply `[RECLASSIFY: Open Question]` and do not apply `[RECLASSIFY: Known Limitation]`.

---

## Filter Pass Results — Complete Before Writing Any ASSUMPTION Block

For every candidate item surfaced during multi-perspective analysis, classify it through the reclassification filter above before writing an ASSUMPTION block:

| Candidate item | Filter verdict | Reason | Action |
|---|---|---|---|
| [item from multi-perspective analysis] | HC / DEP / OQ / KL / Keep as assumption | [why it fits this class] | Reclassify / Keep |

**Do not write any ASSUMPTION block until this table is complete. If you find yourself writing an ASSUMPTION block before this table exists, stop.**

---

## Step 1: Multi-Perspective Analysis

Think through the feature from three perspectives, looking specifically for what could go wrong:

**PM lens:** Does this solve a validated problem? Will target users adopt it? Are success metrics measurable? Any regulatory or compliance assumptions?

**Designer lens:** Will users understand it without training? Are there accessibility barriers? Does the flow handle all states (empty, error, loading)? Any unvalidated user behavior assumptions?

**Engineer lens:** Can it be built with existing infrastructure? Any performance assumptions (response time, data volume, concurrency)? Integration dependencies that could block delivery? Data availability or quality assumptions?

## Step 2: Assumption Format

Every assumption uses this format:

```
### ASSUMPTION: [Falsifiable plain-English statement. One assumption per block.]
- SOURCE: [Where it came from — SRC-N section, transcript decision, or "Implicit"]
- STATUS: Not confirmed / Partially confirmed / Confirmed / Contradicted
- RISK AREA: Value / Usability / Viability / Feasibility
- VALIDATE WITH: [Person or team] | BY WHEN: [Date or milestone]
- RISK IF WRONG: [Concrete consequence — what breaks, what gets blocked]
```

Rules: falsifiable, specific, one assumption per block, traceable to a source.

## Step 3: Prioritize

| Priority | Criteria | Action |
|---|---|---|
| **HIGH** | If wrong, blocks the feature or creates legal/compliance/financial exposure | Validate before design begins |
| **MEDIUM** | If wrong, degrades quality or requires significant rework | Validate before development begins |
| **LOW** | If wrong, minor impact | Only include if it changes an FR, OQ, scope, or timeline — otherwise omit |

Present grouped: HIGH → MEDIUM → LOW, then by risk area within each group.

## Step 4: Cross-Reference with Scenario Matrix

If a Stage 4 artifact exists, check:
- Do any scenarios depend on an unvalidated HIGH assumption?
- Are threshold values in the matrix assumed or confirmed?
- Does the matrix assume actor behavior that hasn't been validated?

Flag unvalidated dependencies between assumptions and scenarios.

---

## Save Stage 5 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage5-Assumptions.md`

Summary Card:
```
## Summary Card — Stage 5: Assumptions
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Totals:** [N] HIGH | [N] MEDIUM | [N] LOW | [N] reclassified
**Reclassified:** [N] Hard Constraints | [N] Dependencies | [N] OQs | [N] Known Limitations

**PM review needed before Stage 6 (Standard/Full) or Stage 7a (Express):**
- [ ] [HIGH assumption — plain English, what needs confirming, ID in parentheses]
```

Write each review item as a complete sentence. Assumption IDs in parentheses at end:
❌ `- [ ] A-3: Confirm SSO is out of scope`
✅ `- [ ] The team assumed SSO is out of scope for this release — confirm or correct. (A-3)`

Include all assumptions with full format below the card. End with an `## ACTION REQUIRED` section.

## Checkpoint — Chat Output

Present at most 10 lines:
```
Stage 5 complete. File: [path]

Assumptions: [N] HIGH | [N] MEDIUM | [N] LOW
Reclassified: [N] items

HIGH assumptions requiring your confirmation:
- [A-1]: [assumption statement in plain English]
- [A-2]: [assumption statement in plain English]
[list all HIGH assumptions here — not just in the file]

Confirm each HIGH assumption is correct, or flag one by ID (e.g. "flag A-2") before proceeding to Stage 6 (Standard/Full) or Stage 7a (Express).
```

## State File Update

- `current_task` → `"stage5"`
- `stages_completed` → add `"stage5"`
- `artifacts.stage5` → file path
- `gates_passed.stage5_confirmed` → `true` (after PM confirms HIGH assumptions)