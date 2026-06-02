# Stage 2: Interpretation Checkpoint

> **Gate:** Do not proceed to Stage 3 without user confirmation at both checkpoint parts (INFERRED review + accuracy spot-check). This is a mandatory stop regardless of pipeline mode.

---

## Analysis

Read all source summaries from `_runs/[run-name]/source_summaries/`. Read the Stage 1b artifact for the current state field.

Extract and classify every item from source documents:

- **STATED** — directly present in the source. Cite: `(Source: SRC-N, section)`
- **INFERRED** — derived, extrapolated, or gap-filled. Cite: `(Based on: SRC-N)` and include one sentence of reasoning.

Organize into these sections in the artifact:
1. **Problem / Feature** — 1–2 sentences
2. **Current State** — from Stage 1b artifact. If absent: `[CURRENT STATE UNKNOWN — not provided]`
3. **STATED facts** — with source IDs
4. **INFERRED conclusions** — with reasoning and source basis
5. **Actors** — role and relevance, with source
6. **Constraints / rules** — with source
7. **Open / unclear items** — what is missing and why it matters
8. **Decisions made** — from transcripts or PM decisions, with source

---

## Inference Register Rules

- Confirmed inferences → reclassify as STATED. Cite as `(Source: User-confirmed)`
- Rejected inferences → removed entirely. Do not carry forward to Stage 3+.
- Unresolved inferences → mark `[TBD]`. Must not appear as confident fact in later stages.

---

## Accuracy Spot-Check

Identify the 3 STATED facts most frequently referenced across actors, constraints, and scope in this artifact. These are the claims most likely to corrupt downstream content if wrong.

Present each as:
```
SRC-[N] states: "[exact quote or close paraphrase from the source]"
→ Open SRC-[N] and confirm this is accurate.   YES / NO / CORRECTION: ___
```

The checkpoint gate does not pass until:
- [ ] All INFERRED items confirmed, corrected, or rejected — YES/NO
- [ ] All 3 accuracy spot-check items verified against source documents — YES/NO

---

## Save Stage 2 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage2-Interpretation.md`

Begin the artifact with this Summary Card:

```
## Summary Card — Stage 2: Interpretation
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3 findings:**
1. [Most important STATED fact extracted]
2. [Most important INFERRED item needing confirmation]
3. [Most important open item — or "All open items resolved"]

**New vs. Stage 1:** [What interpretation added — e.g., "4 inferences derived; 2 open questions identified"]

**PM review needed before Stage 3:**
- [ ] [Sentence describing what the PM must confirm or reject — one item per bullet]
- [ ] Verify 3 accuracy spot-check facts against source documents — listed at end of artifact
```

Write each review item as a complete sentence. Internal codes go in parentheses at the end, never as the lead:
❌ `- [ ] INFERRED-3: Confirm biometrics are mandatory at first login`
✅ `- [ ] The team inferred biometrics are mandatory at first login — confirm or correct. (INFERRED-3)`

Include all 8 analysis sections below the Summary Card. Close with an `## Accuracy Spot-Check` section containing the 3 spot-check items formatted as above.

---

## Checkpoint — Chat Output

Present at most 10 lines in chat:

```
Stage 2 complete. File: [path]

Found: [N] STATED facts | [N] INFERRED items | [N] open items
Accuracy spot-check: [short label for fact 1] | [short label for fact 2] | [short label for fact 3]
→ Verify these 3 against their source documents before confirming.

Review the file, then confirm to proceed, or flag any issue.
```

---

## State File Update

After both checkpoint parts pass, update `pipeline-state.json`:
- `current_task` → `"stage2"`
- `stages_completed` → add `"stage2"`
- `artifacts.stage2` → file path
- `gates_passed.stage2_confirmed` → `true`
