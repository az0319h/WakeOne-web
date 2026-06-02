# Stage 8: Risk Analysis

> Runs after Stage 7b. Updates Section 8 (Known Limitations) and Section 9.2 (Risks) in the generated document. Do not add risk content inside FR bullets.

---

## Step 1: Known Limitations

Identify confirmed limitations from Stage 5 `[RECLASSIFY: Known Limitation]` items plus any new trade-offs found during pre-mortem analysis.

**Sort and format rules before writing to document:**
- Sort by impact — highest-impact item first
- Bold the lead sentence of the highest-impact item only: `**[One-sentence impact statement.]** Explanation follows.`
- Each item: one sentence stating the limitation, one sentence on impact or workaround if relevant

Write to Section 8 of the generated document.

## Step 2: Pre-Mortem Analysis

Using the Stage 7b requirements document, Stage 5 unconfirmed assumptions, and Stage 4 edge case scenarios, produce a Tigers / Paper Tigers / Elephants analysis:
- **Tigers** — Real, high-impact risks needing mitigation
- **Paper Tigers** — Risks that seem scary but are manageable
- **Elephants** — Obvious problems nobody has addressed

Work one category at a time: Tigers first, then Paper Tigers, then Elephants. For each candidate, run the Pre-Registration Filter before adding to the Risks table.

## Pre-Registration Filter

Run before adding any risk to the table. A risk that fails any check already has an owner — do not duplicate it.

**Mandatory pre-step:** Before running this filter for any candidate risk, read Section 10 of the requirements document (already open from the §8 update in Step 1) and note all existing OQ rows. Use this as your reference when answering the OQ question in row 2 below. This check applies even if the candidate risk was sourced from Stage 5 — the generated §10 takes precedence over Stage 5 source artifacts.

| Question | If YES | Correct action |
|---|---|---|
| Is there an existing dependency (Section 9.1) that owns this deliverable gap? | The gap is tracked under a dependency. | Do not add as a risk. Exception: if there is a consequence beyond what the dependency captures (e.g., a Phase 2 scope decision), add a risk for that consequence only. |
| Is there an existing Open Question (Section 10) that owns this uncertainty? | The uncertainty is already in Section 10. | Do not add as a risk. Write a note in the Stage 8 artifact: `[Blocked by OQ: [OQ description] — §9.2 entry not created; expand §10 row if needed.]` If the OQ's scope is incomplete, expand it instead of creating a parallel risk entry. |
| Is this already enforced by a Hard Constraint (Section 9.1)? | The HC already requires the correct behavior. | Do not add as a risk. At most, note it as a QA verification item. |
| Is this an operational or launch concern (comms plans, rate limits, help desk readiness)? | Requirements cannot own operational readiness. | Do not add. Route to Section 8 Known Limitations if it needs to appear anywhere. |

**A risk belongs in the register only when all four answers are NO** — no existing section owns the concern, and the mitigation requires adding new information not captured anywhere else.

**The distinction:**
- "Design for the biometric-configured state has not been delivered" → this is a dependency. The risk of not delivering it is captured by the dependency's blocking status.
- "If the hard gate fires incorrectly, all 47K officers are locked out with no in-app circuit-breaker" → this is a risk. No dependency, OQ, or HC owns the circuit-breaker gap. The mitigation (add a server-side kill switch) is new information.

**Do NOT embed risk mitigations inside FR bullets. Do NOT add `(See Risk R-N)` cross-references to FR bullets.** Section 9.2 Risks is the only location for risk content. The connection is visible through the risk description naming the affected FR.

## Risk Table Format

| Risk ID | Description | Type | Probability | Impact | Owner | Mitigation |
|---------|-------------|------|-------------|--------|-------|------------|
| R-1 | [description] | Tiger / Paper Tiger / Elephant | High / Medium / Low | Critical / High / Medium / Low | [Owner] | [Mitigation] |

**Description format:** [What could go wrong] → [user-visible or business-visible consequence] → [scale: how many users affected or what business impact].

Write so a director with no technical background understands what is at risk. Translate system-internal consequences to what the user experiences. Technical root causes belong in the Mitigation column.

✅ "Version check runs after sign-in instead of before → users complete full sign-in then hit an update block → wasted sign-in attempt, poor first impression at launch for all users"
❌ "capabilities.latestVersion called post-auth → redundant session initiated before gate fires"

**Mitigation format:** Write only what is not already tracked in Section 10 Open Questions, Section 9.1 Constraints, or dependencies.
- **Additive mitigation:** new specification, verification step, design scoping, or cross-feature consequence not captured elsewhere — write in full
- **OQ cross-reference:** `→ OQ-N` — add one sentence only if there is a consequence beyond what the OQ already asks
- **Constraint restatement:** `→ Section 9.1 Hard Constraints` — do not repeat the constraint

✅ "Require secure system browser (ASWebAuthenticationSession on iOS, Custom Chrome Tab on Android). → OQ-3."
❌ "Confirm sign-in mechanism per OQ-3. Require system browser: ASWebAuthenticationSession (iOS), Custom Chrome Tab (Android)." — the OQ cross-reference covers the action; the technical spec is the only additive part.

**Impact scale for Section 9.2:** Use `Critical`, `High`, `Medium`, or `Low`. Tiger/Paper Tiger/Elephant labels are for analysis only — do not appear in the document output.

Sort by Impact descending (Critical first). Within each tier: (1) most users affected, (2) revenue or compliance consequence, (3) implementation complexity.

---

## §9.2 Routing Rule

Apply after all risks are generated and sorted.

Count all risks that passed the Pre-Registration Filter. Sort by Impact descending (Critical → High → Medium → Low). Within each tier, use: (1) most users affected, (2) revenue or compliance consequence, (3) implementation complexity.

- **Top 4 risks (positions 1–4 in the sorted list) → §9.2 of the document.** Write using the template's 3-column format: `| Risk | Impact | Mitigation |`. Write the Risk cell as: `R-N: [What goes wrong → consequence]`. Do not write Probability or Owner in §9.2.
- **Remaining risks (positions 5+) → Appendix F.** Write using the full 6-column format: `| Risk ID | Description | Probability | Impact | Owner | Mitigation |`
- **Callout rule:** If Appendix F is created, add this line as the last line of §9.2: `> See Appendix F: Full Risk Register`
- **If total risks ≤ 4:** all go to §9.2, no Appendix F needed.

---

## Save Stage 8 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage8-Risk-Analysis.md`

Summary Card:
```
## Summary Card — Stage 8: Risk Analysis
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3:**
1. [Highest-impact Tiger — most likely to block or break the feature]
2. [Most important Elephant — obvious problem nobody has addressed]
3. [Most surprising Paper Tiger — seemed scary but is manageable]

**New vs. Stage 7b:** [Known Limitations added: N | Risks added: N]

**PM review needed before Stage 9:**
- [ ] [Tiger without a confirmed mitigation owner — complete sentence, R-N in parentheses at end]
```

Write each review item as a complete sentence:
❌ `- [ ] R-3: No mitigation owner assigned`
✅ `- [ ] The Face ID permission revocation risk on iOS has no assigned mitigation owner — assign before Stage 9. (R-3)`

## Checkpoint — Chat Output

```
Stage 8 complete. File: [path]

Known Limitations added: [N] | Risks added: [N total — N Tigers, N Paper Tigers, N Elephants]
Highest-impact Tiger: [one-sentence description]

Review and confirm to proceed to Stage 9.
```

## State File Update

- `current_task` → `"stage8"`
- `stages_completed` → add `"stage8"`
- `artifacts.stage8` → Stage 8 artifact path