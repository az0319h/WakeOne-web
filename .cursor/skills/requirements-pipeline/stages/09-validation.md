# Stage 9: Validation (MANDATORY FINAL STEP)

> Gate stage. Do not mark the document as final until the PM confirms all Critical findings are resolved and Should Fix decisions are recorded.

---

## Pass 1: Section Sub-Bucket Dedup (always runs first)

Scan all six Section buckets: Hard Constraints (9.1), Dependencies (9.1), Risks (9.2), Assumptions (9.3), Known Limitations (8), Open Questions (10). Each item gets exactly one home.

| Classification | Definition | It is NOT also... |
|---|---|---|
| **Hard Constraint** | Non-negotiable system rule (regulatory, legal, timeline) | a dependency or limitation |
| **Dependency** | Deliverable another team must provide before we can build | an assumption or limitation |
| **Assumption** | Unconfirmed belief; carries risk if wrong | a dependency (if it has an owner and delivery status, it is a dependency) |
| **Known Limitation** | Confirmed gap we are shipping with (accepted trade-off) | a dependency (if it is blocking and has an owner, it is a dependency) |
| **Open Question** | Stakeholder decision needed before proceeding | an assumption or dependency (if it needs a decision, the OQ owns it) |
| **Risk** | Threat to delivery, quality, or adoption | not a constraint. If a risk is resolved, move it to Known Limitations. |

**Tiebreaker rules:**
1. Assumption + Dependency overlap: keep Dependency, delete Assumption
2. Known Limitation + Dependency overlap: keep Dependency, delete Known Limitation
3. Constraint + Dependency overlap: keep Constraint only if it states a non-negotiable rule
4. Assumption + Open Question overlap: keep Open Question, delete Assumption. After deleting, scan every OQ's Blocks field — remove any reference to the deleted assumption number.
5. Known Limitation + Open Question overlap: keep Open Question, delete Known Limitation. A KL requires the trade-off to be confirmed and accepted — a pending decision means it has not been accepted. After deleting the KL, confirm the OQ's Question cell describes what decision is needed and that an Owner is assigned. If the Owner field is empty, flag: `[OQ owner required — this item cannot remain as KL without an owner.]`
6. Dependency + Open Question overlap: keep both only if the OQ asks a design/policy question separate from delivery
7. Two OQs on the same topic: merge into one
8. Two Constraint bullets for the same rule: keep the more specific one
9. Confirmed assumption with no trade-off: delete. Confirmed assumption with a trade-off: move to Known Limitations.
10. Absorb useful context from deleted duplicates into the surviving instance
11. Update all cross-references after renumbering

Record count of duplicates resolved. Include in the validation report.

## Pass 2: Cross-FR / Hard Constraint Dedup

Scan all FR bullets for restatements of Hard Constraints.

**Rule:** For each Hard Constraint in Section 9.1, read every FR bullet. If an FR bullet states the same non-negotiable rule as a Hard Constraint — remove the FR bullet. The Hard Constraint is the single source of truth.

**Test for equivalence:** Does this FR bullet add any testable behavior beyond what the Hard Constraint already guarantees? If no — remove. If yes — keep.

Remove: Hard Constraint "Biometric flows are fully OS-managed" → FR bullet "The app does not manage retry limits — the phone does." Same rule, no additional behavior.

Keep: Hard Constraint "Okta OIDC is the sole auth provider" → FR bullet "If sign-in fails, the officer returns to the sign-in screen with no error message." Specific behavior not in the constraint.

Record count of FR bullets removed. Add to dedup total.

## Pass 3: FR Quality Pass

Run before validate-requirements. Record findings under "FR Quality."

**FR Title Check:**
- [ ] Every FR title names a user action or capability — not a screen name without behavior, not a system state
- [ ] No two FRs covering the same broad action share an undifferentiated title

**Description Line Check:**
- [ ] Every Simple FR (≤3 testable bullets, no conditionals, no external system, no failure paths) has no description line
- [ ] Every Complex FR description passes uniqueness: does not restate bullets 1+2 in prose, does not make a claim an unresolved OQ contradicts
- [ ] Any description failing uniqueness is deleted — a missing description is a correct state

**Bullet Structure Check:**
- [ ] No two bullets in the same FR describe different triggers leading to an identical user experience — merge with conditional syntax
- [ ] No [TBD]-only bullets remain — each must be deleted with its OQ confirmed in Section 10
- [ ] No screen-content bullets in interaction FRs — they belong in the FR that defines the screen

**HOW Violation Check:**
- [ ] Apply the demo test to every FR bullet: "Can a PM verify this outcome in a demo without reading the code?" If no — HOW violation
- [ ] Flag any bullet naming an API call, database operation, internal state variable, OS callback, or evaluation algorithm — HOW violation regardless of phrasing

**Finding severity:** Two parallel FRs with indistinguishable titles = Critical. HOW violation in a Critical FR = Critical. All other FR quality findings = Should Fix.

**§9.2 Structure Check:**
- [ ] §9.2 has at most 4 rows — YES/NO. If NO: risks beyond position 4 must move to Appendix F.
- [ ] §9.2 uses exactly 3 columns (Risk | Impact | Mitigation) — no Risk ID, Probability, or Owner columns in the main body — YES/NO. If NO: reformat to 3-column and move detail to Appendix F.
- [ ] If §9.2 has fewer than 4 rows and no Appendix F: confirm total risks ≤ 4, not that risks were omitted — YES/NO.
- [ ] If Appendix F exists: §9.2 contains `> See Appendix F: Full Risk Register` as its last line — YES/NO.

**§9.2 finding severity:** §9.2 with more than 4 rows = Should Fix. §9.2 with more than 3 columns = Should Fix. Missing callout when Appendix F exists = Should Fix.

## Pass 4: Stage 5 Assumption Carry-Through

Verify every HIGH and MEDIUM assumption from Stage 5 that was NOT reclassified appears in Section 9.3.

1. From Stage 5, list all HIGH and MEDIUM assumptions not reclassified as HC, DEP, or OQ
2. For each, confirm it appears in Section 9.3 by name or equivalent description
3. Any missing assumption: flag as Should Fix, add it to Section 9.3 with its original rating and risk statement

LOW assumptions absent from Section 9.3 with no explanation: Minor finding.

## Pass 5: Semantic and Structural Validation

**MANDATORY READ:** `validate-requirements` skill — run on the requirements document after Passes 1–4 are applied. If the skill is unavailable in this session, perform all checks manually from the skill definition and note `[SKILL UNAVAILABLE — manual pass]` in the validation report.

Provide as inputs:
- The requirements document (after dedup)
- The source documents folder (Stage 1 source_summaries)
- Sibling requirements docs (if multiple feature docs were generated)

This skill performs 15 checks covering: source accuracy, requirement purity, testability, ambiguity, assumption-requirement dependency, negative path coverage, scope boundary, intra-document consistency, staleness markers, contradictions, broken cross-references, and completeness gaps.

**Fix all Critical findings immediately.** Present Should Fix and Verify findings to the PM for decision.

**STOP and WAIT for PM to review findings.** Do not mark the document as final until the PM confirms all findings are resolved.

**Should Fix changelog (MANDATORY when SF items are applied):**

```
[SF-N] was: "[exact original text]" → now: "[revised text]"
```

Do not mark an SF item ✅ without this entry. A ✅ with no changelog entry is unverified.

---

## Save Stage 9 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage9-Validation-Report.md`

Summary Card:
```
## Summary Card — Stage 9: Validation
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3:**
1. [Most critical finding — must be resolved before stakeholder review]
2. [Most common finding type — e.g., "6 cross-section duplicates resolved in Pass 1"]
3. [Most important structural issue — or "No structural issues found"]

**New vs. Stage 8:** [N Critical | N Should Fix | N Verify | N duplicates resolved]

**PM review needed to close out:**
- [ ] [Critical finding — complete sentence, V-N in parentheses at end]
- [ ] [Should Fix decision needed — or "No Should Fix items requiring PM input"]
```

Write each review item as a complete sentence:
❌ `- [ ] V-2: FR-3 bullet 2 fails testability check`
✅ `- [ ] One requirement in the biometric login section cannot be tested as written — rewrite before sign-off. (V-2, FR-3)`

## Checkpoint — Chat Output

Present at most 10 lines:
```
Stage 9 complete. File: [path]

Dedup: [N duplicates resolved across Passes 1-2]
FR Quality: [N Critical | N Should Fix]
Assumption carry-through: [N verified | N gaps]
validate-requirements: [N Critical | N Should Fix | N Verify]

Review findings in file. Confirm each Critical finding is resolved before sign-off.
```

## State File Update

- `current_task` → `"stage9"`
- `stages_completed` → add `"stage9"`
- `artifacts.stage9` → Stage 9 artifact path
- `gates_passed.stage9_confirmed` → `true` (after PM confirms all Critical findings resolved)