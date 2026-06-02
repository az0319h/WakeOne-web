# Stage 7b: Generate Requirements Document

> Orchestration only. Behavioral rules are in `reference-tables.md`. Format contract is in `templates/feature-requirements-v2.md`. Do not begin until Stage 7a shows `Ready to generate: YES`.

---

## MANDATORY READ

1. `templates/feature-requirements-v2.md` — output format contract. Every section, heading level, and table structure must match exactly.
2. `reference-tables.md` — all sections apply: Writing Rules, Format Rules, FR Purity Rules, FR Bullet Hierarchy Rule, Appendix Routing Rules, Platform Purity Rule, Section Boundary Rules.

**Load confirmation (required before generating):** State this exact sentence from the FR Purity Rules section of `reference-tables.md`: "Can a PM verify this in a demo without reading the code?" If you cannot quote this exactly, stop and re-read the file before continuing.

---

## Pre-Generation Prohibition

Before writing any FR bullet, apply this test: **Can a PM verify this in a demo without reading the code?** If no — it is a HOW violation. Rewrite as the user-observable outcome.

❌ HOW: "The Login screen evaluates the user's stored sign-in preference against the device's current biometric enrollment state before rendering the sign-in button."
✅ WHAT: "The Login screen shows only the sign-in option that matches the user's configured preference and current device capabilities."

---

## Generation Instruction

> **Governing rule:** 7b reads only from the Stage 7a synthesis artifact. Original stage artifacts (Stage 1–6) are not opened during generation. The sole exception is Section 7 (FRs) — 7b reads source content from the per-FR content blocks embedded in the 7a artifact. All source text was extracted and verified by 7a and is available inline. If any pre-staged block is absent from the 7a artifact, write `[MISSING — Stage 7a did not produce this block]` in the corresponding section and flag in the Generation Summary Card.

**Section-by-source reference table** (all strategies draw from this table):

| Section | Source |
|---|---|
| 1. Overview | 7a §Overview Fact Clusters — write one sentence per slot from the pre-staged cluster (Problem / Feature / Change / Constraint). Each slot holds 2–4 tagged facts; synthesize into one sentence. Write all four sentences as a single continuous paragraph — no blank lines between sentences. The slot sequence (Problem → Feature → Change → Constraint) determines sentence order within the paragraph, not separate line breaks. Do not scan Stage 2 directly. |
| 2. Personas | 7a §Persona Table — transcribe directly. |
| 3. User Goals | 7a §User Goals — transcribe directly. |
| 4. Scope | 7a §Scope — transcribe In Scope and Out of Scope lists. Check Synthesis Context for any `[SCOPE GAP]` items and note them at the end of the section. |
| 5. What's Changing | 7a §What's Changing Table — transcribe directly. Omit section entirely if block is absent (greenfield feature). |
| 6. User Flows | 7a §User Flows — transcribe 4-column table directly. After writing the table, apply the Appendix A and B routing check — scan every FR content block in the 7a artifact (already open): (A) Appendix A needed if any single FR has 3 or more distinct conditional interface states — bullets that each show a different combination of visible controls or labels based on a different condition. (B) Appendix B needed if any single flow has 3 or more distinct error conditions with different recovery paths. Then write the redirect line only if at least one check is YES: both needed → `*Visual states and error handling: see Appendix A and B.*` / only A → `*Visual states: see Appendix A.*` / only B → `*Error handling: see Appendix B.*` / neither → omit the line entirely. This check runs independently in Pass 1 (for the callout) and again in the appendix-writing pass (for content) — no flag state is carried between passes. |
| 7. FRs | 7a §FR Plan content blocks — one FR per block in order. Write one bullet per source line in the block. For each bullet: (1) split compound content using the period-replacement test first; (2) apply the property-vs-sequence test FIRST — "Does this bullet describe a property, content, or constraint OF the preceding outcome, or does it describe what happens NEXT after it?" If NEXT → flat peer, regardless of causal connection. (3) if the property-vs-sequence test says property/content, apply the parent-child test as a secondary check — "If the preceding bullet were removed, would this bullet stand alone as a meaningful requirement?" If no → sub-bullet. If yes → flat peer. Both tests must pass for a sub-bullet. Never nest a bullet that still contains two outcomes — split first, nest second. Max one level of nesting. Carry inline verification tags: bullets tagged `Stage 2 derivation — not re-verified` append `(Source: Stage 2 derivation — original not confirmed)`. Bullets written as `[TBD — source not confirmed]` in the block remain as `[TBD]` bullets in the document. Transcribe Implementation Notes directly from the block. Do not open Stage 1–6 artifacts. For branch-structured FRs: when source bullets carry inline branch prefixes (e.g., `[Approve:]`, `[Deny:]`, `[Yes:]`, `[No:]`), convert those prefixes to bold labels using the branch label format in reference-tables.md. Group bullets under their matching bold label. Shared preamble bullets (no prefix) appear above the first bold label. Do not write branch bullets as a flat inline-prefixed list — the bold label format is the required output form. |
| 8. Known Limitations | 7a §Known Limitations — transcribe sorted bullets directly. Append: `*Stage 8 Risk Analysis pending — update after Stage 8 completes.*` |
| 9.1 Constraints | 7a §Reclassification routing table — write all rows marked Section 9.1 (HC and DEP rows). Add all NC items marked `added to 9.1` from 7a §NC Routing Phase B result. |
| 9.2 Risks | Stage 8 not yet run at generation time. Write exactly one placeholder row: `Risk ID = "—" / Description = "Stage 8 Risk Analysis pending — update after Stage 8 completes." / all other cells = "—"` |
| 9.3 Assumptions | 7a §Assumptions — transcribe directly. |
| 10. Open Questions | 7a §Open Questions — transcribe Critical/High rows. For Appendix G: write routing note per 7a §Open Questions "Appendix G routing" line. |
| 11. References | 7a §References — transcribe directly. |

**Source citation format on every FR bullet:** `(Source: SRC-N, section)` — cite every sourced claim. Tag unsourced claims `(Source: Implicit)` — review each before saving.

**Platform FRs:** Use `**[Platform]:**` labeled bullet groups within one FR. Do not create separate FRs per platform.

**Pre-staged content rewrite authorization:** When any mini gate compound check produces NO on pre-staged content from 7a (Sections 4, 8, 9.1, or 10): the "transcribe directly" instruction does not apply to the failing item. Rewrite the failing sentence or bullet to pass the period-replacement test before appending. This authorization is scoped to gate failures only — clean pre-staged content is still transcribed as-is.

---

### Step 1: Select Strategy

Read `pipeline_mode`, `Complexity`, and `Size` from the state file. Count `**FR-N:**` header occurrences in the 7a artifact to get the FR count.

| pipeline_mode | Complexity | Size | FR count | Strategy |
|---|---|---|---|---|
| Express | any | any | any | **A** — always; Stages 4 and 6 not run; output is inherently shorter |
| Non-Express | Simple | any | any | **A** — ceiling ≤1,500 words across all Simple variants |
| Non-Express | Medium | Small | ≤6 | **A** — ceiling 700–1,200 words |
| Non-Express | Medium | Small | 7+ | **B** — FR count overrides size |
| Non-Express | Complex | Small | any | **C** — Complex FRs run 150–250 words each; combining with back-matter exceeds ~2,000 words at 5+ FRs |
| Non-Express | Medium | Medium | ≤6 | **B** — ceiling 1,500–2,500 words |
| Non-Express | Medium | Medium | 7+ | **C** — FR count overrides |
| Non-Express | Medium | Large | any | **C** — ceiling 2,500–3,500 words |
| Non-Express | Complex | Medium | any | **C** — ceiling 2,500–4,000 words |
| Non-Express | Complex | Large | <12, no platform split | **C** — ceiling 4,000–6,000 words |
| Non-Express | Complex | Large | 12+ FRs OR multi-platform split | **C+batches** |

**FR count guard:** Any routing to Strategy B where FR count > 6 automatically upgrades to Strategy C.

**Platform split detection:** Check FR content blocks for `**[Platform]:**` labeled sections. If two or more distinct platform labels appear across any FRs in a Complex/Large document, apply Strategy C+batches.

**File path for all passes:** `_runs/[run-name]/Generated/Internal/Feature-Requirements-[Feature].md` — run name and feature name come from state file fields `run_id` and `feature`.

**File read-back rule (Pass 2 onward):** Use the Read tool to open the file and read its current contents before writing each pass. Do not continue from memory. If the file is empty, does not exist, or does not contain Section 6, stop and flag: `"Pass 1 output not found at [path] — re-run Pass 1 before continuing."`

**Failure recovery:** If a mini save gate produces a NO item, fix the issue in the current pass output before appending. If the file is partially written and a pass cannot complete, read the file, identify the last complete section, and resume from the next section.

---

### Strategy A — Single Pass

**When:** Express mode; Simple (any size); Medium/Small ≤6 FRs.

Generate all sections 1–11, Generation Summary Card, and appendices in one response. Source all sections per the reference table above. Apply Phase 2/3 Extraction inline after writing Section 7 if any FR is tagged `*(Phase 2/3)*`.

**Gate:** Write all sections 1–11 and the Generation Summary Card. Then apply the Appendix A and B generation instruction below to determine and write appendix content. Then run the full Save Gate (17 items) — word count check requires the complete document before it can be counted. Fix any NO before saving.

**Appendix A and B generation:**

Re-apply the routing check from the Section 6 source table instruction — scan the FR content: use the 7a artifact FR content blocks (Strategy A single pass and Strategy B Pass 2 — the 7a artifact remains in context for these shorter strategies), or the written FR section from the file read-back at the start of this pass (Strategy C Pass 3 and C+batches Pass 3 — the file read-back contains Section 7 written in the prior pass):

Appendix A: count distinct conditional interface states within each FR — bullets that each show a different combination of visible controls or labels based on a different condition. If any FR has 3 or more such states:
- Write `**A — Visual States**` header
- For each qualifying FR, write bold label `**From FR-N: [Title]**` above its table
- Format: `| State | What officer sees | Notes |` — one row per distinct conditional state

Appendix B: identify flows where 3 or more distinct error conditions appear, each with a different recovery path. If any flow qualifies:
- Write `**B — Error Handling**` header
- Format: `| Condition | What officer sees | Recovery |` — 3 columns only, no Cause column — one row per error condition

If neither check fires: write no Appendix A or B content and no headers for either.

---

### Strategy B — Two Passes

**When:** Medium/Medium ≤6 FRs; Medium/Small 7+ FRs (FR count guard upgrade). Complex/Small routes directly to Strategy C regardless of FR count.

**Pass 1 — Sections 1–6 + Generation Summary Card**

Sources: all from 7a pre-staged blocks (transcription only). Generate in order: document header → Generation Summary Card → Sections 1–6.

**Pass 1 mini gate (all YES before writing the file):**
- [ ] No em dashes or semicolons in Sections 1–6 — YES/NO
- [ ] Overview has 3–4 sentences structured as problem → feature → change → constraint, written as a continuous paragraph (no blank lines between sentences) — YES/NO
- [ ] Section 6 routing check: re-apply the Appendix A and B routing check from the section source table row 6 instruction. If either appendix is needed, confirm the correct conditional callout is present citing only the applicable appendices. If neither is needed, confirm no callout is present — YES/NO
- [ ] No compound bullets in Section 4 Scope — each bullet states one capability. Apply period-replacement test. — YES/NO

Write file (create).

**Pass 2 — Section 7 FRs + Sections 8–11 + Appendices**

Use the Read tool to open the file before writing.

Source: Section 7 from 7a FR Plan content blocks; Sections 8–11 from 7a pre-staged blocks. Write Section 7 one FR per content block in FR Plan order — bullets from source lines, verification tags carried, Implementation Notes transcribed. Apply Phase 2/3 Extraction after last FR if applicable. Then write Sections 8–11 and appendices.

**Pass 2 mini gate (all YES before appending):**
- [ ] Every FR uses `###` heading — YES/NO
- [ ] No HOW violations — apply demo test to each FR bullet — YES/NO
- [ ] No tracking tags (R-x, A-x, OQ-x, NC-x, V-x) in any FR bullet — YES/NO
- [ ] One observable outcome per bullet — YES/NO
- [ ] FR bullets in user flow sequence within each FR — YES/NO
- [ ] Every FR routing content to Appendix E has `> See Appendix E: [rule name]` callout — YES/NO
- [ ] Platform-labeled sections use only terminology native to that platform — YES/NO
- [ ] No em dashes or semicolons in Section 7 content — YES/NO
- [ ] Sub-bullet depth does not exceed one level in any FR — YES/NO. If NO: flatten the deepest level to a sub-bullet of its parent. If the relationship genuinely requires three levels, add the flag `[FR-N: candidate for split]` and leave at two levels — do not nest further.
- [ ] Section 8: highest-impact item bolded, sorted by impact, Stage 8 placeholder note present — YES/NO
- [ ] Section 9.1: no item is an open question in disguise — YES/NO
- [ ] No compound sentences or bullets in Sections 8 and 9.1 — each item states one limitation or constraint. Apply period-replacement test. — YES/NO
- [ ] Section 9.3: no reclassified item (HC, DEP, OQ) present — YES/NO
- [ ] Section 10: only Critical/High OQs — YES/NO
- [ ] No compound or multi-part questions in Section 10 — each row has one primary question; related or conditional follow-ons are sub-bullets under the primary; a new row only when the topic is genuinely distinct. Apply period-replacement test to question cells. — YES/NO

**Appendix A and B generation:**

Re-apply the routing check from the Section 6 source table instruction — scan the FR content: use the 7a artifact FR content blocks (Strategy A single pass and Strategy B Pass 2 — the 7a artifact remains in context for these shorter strategies), or the written FR section from the file read-back at the start of this pass (Strategy C Pass 3 and C+batches Pass 3 — the file read-back contains Section 7 written in the prior pass):

Appendix A: count distinct conditional interface states within each FR — bullets that each show a different combination of visible controls or labels based on a different condition. If any FR has 3 or more such states:
- Write `**A — Visual States**` header
- For each qualifying FR, write bold label `**From FR-N: [Title]**` above its table
- Format: `| State | What officer sees | Notes |` — one row per distinct conditional state

Appendix B: identify flows where 3 or more distinct error conditions appear, each with a different recovery path. If any flow qualifies:
- Write `**B — Error Handling**` header
- Format: `| Condition | What officer sees | Recovery |` — 3 columns only, no Cause column — one row per error condition

If neither check fires: write no Appendix A or B content and no headers for either.

Append to file.

**Full Save Gate:** Use the Read tool to open the complete file. Run all 17 Save Gate items. Fix any NO before marking complete.

---

### Strategy C — Three Passes

**When:** Complex/Small (any FR count); Medium/Medium 7+ FRs; Medium/Large; Complex/Medium; Complex/Large (<12 FRs, no platform split).

**Pass 1 — Sections 1–6 + Generation Summary Card**

Identical to Strategy B Pass 1. Apply the same Pass 1 mini gate. Write file (create).

**Pass 2 — Section 7 FRs only**

Use the Read tool to open the file before writing.

Source: 7a FR Plan content blocks only. Write Section 7 — one FR per content block in FR Plan order. For each FR: write bullets, carry verification tags, transcribe Implementation Notes. Apply Phase 2/3 Extraction after last FR if applicable.

**Pass 2 mini gate (all YES before appending):**
- [ ] Every FR uses `###` heading — YES/NO
- [ ] No HOW violations — YES/NO
- [ ] No tracking tags in any FR bullet — YES/NO
- [ ] One observable outcome per bullet — YES/NO
- [ ] FR bullets in user flow sequence — YES/NO
- [ ] Appendix E callouts present where required — YES/NO
- [ ] Platform-labeled sections use only terminology native to that platform — YES/NO
- [ ] No em dashes or semicolons in Section 7 content — YES/NO
- [ ] Sub-bullet depth does not exceed one level in any FR — YES/NO. If NO: flatten the deepest level to a sub-bullet of its parent. If the relationship genuinely requires three levels, add the flag `[FR-N: candidate for split]` and leave at two levels — do not nest further.

Append to file.

**Pass 3 — Sections 8–11 + Appendices**

Use the Read tool to open the complete file (including all written FRs) before writing.

Sources: 7a pre-staged blocks. Additionally: scan the written FR section for any constraint, dependency, or assumption mentioned in an Implementation Note that does not appear in the 7a §Reclassification routing table. Add only items absent from that table — do not add items already routed in 7a.

**Pass 3 mini gate (all YES before appending):**
- [ ] Section 8: highest-impact item bolded, sorted by impact, Stage 8 placeholder present — YES/NO
- [ ] Section 8: every item reflects confirmed feature scope (nothing from stages where scope was narrowed) — YES/NO
- [ ] Section 9.1: no item is an open question in disguise — YES/NO
- [ ] Section 9.1: any new constraint added from FR scan is absent from the 7a Reclassification routing table — YES/NO
- [ ] Section 9.3: no reclassified item (HC, DEP, OQ) present — YES/NO
- [ ] Section 10: only Critical/High OQs; Medium/Low routing confirmed in Appendix G — YES/NO
- [ ] Section 9.2: exactly one placeholder row — YES/NO
- [ ] No em dashes or semicolons in Sections 8–11 content — YES/NO
- [ ] Scope-drift check: every FR capability appears in the Stage 3.5b confirmed scope registry — YES/NO
- [ ] No compound sentences or bullets in Sections 8 and 9.1 — each item states one limitation or constraint. Apply period-replacement test. — YES/NO
- [ ] No compound or multi-part questions in Section 10 — each row has one primary question; related or conditional follow-ons are sub-bullets under the primary; a new row only when the topic is genuinely distinct. Apply period-replacement test to question cells. — YES/NO

**Appendix A and B generation:**

Re-apply the routing check from the Section 6 source table instruction — scan the FR content: use the 7a artifact FR content blocks (Strategy A single pass and Strategy B Pass 2 — the 7a artifact remains in context for these shorter strategies), or the written FR section from the file read-back at the start of this pass (Strategy C Pass 3 and C+batches Pass 3 — the file read-back contains Section 7 written in the prior pass):

Appendix A: count distinct conditional interface states within each FR — bullets that each show a different combination of visible controls or labels based on a different condition. If any FR has 3 or more such states:
- Write `**A — Visual States**` header
- For each qualifying FR, write bold label `**From FR-N: [Title]**` above its table
- Format: `| State | What officer sees | Notes |` — one row per distinct conditional state

Appendix B: identify flows where 3 or more distinct error conditions appear, each with a different recovery path. If any flow qualifies:
- Write `**B — Error Handling**` header
- Format: `| Condition | What officer sees | Recovery |` — 3 columns only, no Cause column — one row per error condition

If neither check fires: write no Appendix A or B content and no headers for either.

Append to file.

**Full Save Gate:** Use the Read tool to open the complete file. Run all 17 Save Gate items. Fix any NO before marking complete.

---

### Strategy C+batches — Three Passes with FR Batching

**When:** Complex/Large with 12+ FRs OR multi-platform split detected (two or more distinct `**[Platform]:**` label groups present in FR content blocks).

**Batch split rule:** Sort FR content blocks by Flow position (UF-N) to establish flow sequence order. Split at the midpoint of FR count — not UF-N count. If 14 FRs: Batch 1 = FRs 1–7, Batch 2 = FRs 8–14. If FR count is odd, Batch 1 gets the smaller half. FRs with no UF-N tag (cross-cutting or tagged `No UF`) go at the end — Batch 2 if FR count is even, Batch 1 if odd.

**Pass 1 — Sections 1–6 + Generation Summary Card:** Identical to Strategy C Pass 1.

**Pass 2a — Section 7, Batch 1 FRs**

Use the Read tool to open the file before writing.

Write FR Batch 1 in flow sequence order. Begin the `## 7. Functional Requirements` heading before the first FR. Do not close Section 7 — Pass 2b continues it.

**Pass 2a mini gate:** Same 9-item gate as Strategy C Pass 2 mini gate applied to Batch 1 FRs only. All items YES before appending.

Append to file.

**Pass 2b — Section 7, Batch 2 FRs**

Use the Read tool to open the file (including Batch 1 FRs) before writing.

Continue Section 7 — no new section heading. Write FR Batch 2 in flow sequence order. Apply Phase 2/3 Extraction after the last FR if applicable.

**Pass 2b mini gate:** Same 9-item gate as Strategy C Pass 2 mini gate applied to Batch 2 FRs only. All items YES before appending.

Append to file.

**Pass 3 — Sections 8–11 + Appendices:** Identical to Strategy C Pass 3 — read complete file first.

**Full Save Gate:** Use the Read tool to open the complete file. Run all 17 Save Gate items. Fix any NO before marking complete.

---

## Phase 2/3 Extraction

If any FR is tagged `*(Phase 2/3)*`:
1. Create `Phase-2-3-Requirements-[Feature].md` at the same output path — copy each deferred FR in full
2. Replace the FR body in the main document with a one-line Out of Scope entry: "[capability] — see Phase-2-3-Requirements-[Feature].md"
3. The main document must contain no `*(Phase 2/3)*` FR bodies after extraction

If no Phase 2/3 FRs exist, skip.

## Generation Summary Card

Add immediately after the document header (Pass 1 for all strategies):

```
## Generation Summary
**Mode:** [Express / Standard / Full] | **Input Quality:** [HIGH / MEDIUM / LOW]
**FRs:** [N total] | **TBDs:** [N critical, N important] | **Open Questions:** [N]
**Stage 8 Risks:** Pending

Key gaps to resolve before handoff:
- [ ] [Most important TBD or open question — or "No critical gaps"]
```

TBD and Open Question counts come from the 7a Synthesis Context — do not re-count during generation.

---

## Save Gate — All Must Be YES Before Marking Complete

- [ ] No pipeline tracking tags (R-x, A-x, OQ-x, NC-x, V-x) in any FR bullet — YES/NO
- [ ] Every FR with content in Appendix E has a callout line (`> See Appendix E: [rule name]`) in its body — YES/NO
- [ ] Each platform-labeled section uses only terminology native to that platform — YES/NO
- [ ] Known Limitations sorted by impact; highest-impact item has a **bold lead sentence** — YES/NO
- [ ] Overview: ≤4 sentences written as a continuous paragraph (no blank lines between sentences). Each sentence passes the period-replacement test — if "and" can be replaced with a period, split the sentence. — YES/NO
- [ ] Scope-drift check: every FR capability appears in the Stage 3.5b confirmed scope registry. Check the Stage 3.5b artifact "In Scope" list. YES / NO — if NO, list each FR and capability not in the registry.
- [ ] Zero em dashes (—) anywhere in the document — YES/NO
- [ ] Zero semicolons (;) anywhere in the document — YES/NO
- [ ] No compound bullets or sentences anywhere in the document — one idea per bullet or sentence. Apply the period-replacement test from reference-tables.md Writing Rules. — YES/NO
- [ ] FR bullets within each FR ordered by user flow sequence (matches Stage 6 flow order) — YES/NO
- [ ] FR sub-bullets: for each sub-bullet, confirm both: (a) the immediately preceding top-level bullet is its parent and is required for the sub-bullet to be understood, AND (b) the sub-bullet describes a property, content, or constraint OF the parent outcome — not what happens next in sequence. State: "[N] sub-bullets. Each verified as property/content of parent — not a sequential next step." Do not mark YES without this statement. — YES/NO
- [ ] FR proportionality: state "[N] FRs in document, [N] UF-N flows from Stage 7a synthesis context. Ratio: [N:N]. Within bounds (≤2×): YES / NO." Express mode: state FR count only — no UF-N comparison. If not Express and ratio exceeds 2×, identify merge candidates using the FR Boundary Rule in reference-tables.md and consolidate before saving. — YES/NO
- [ ] FR bullet count: for every FR, state its final bullet count. Any FR with fewer than 4 or more than 12 bullets fails this gate. State: "FR-N: [N] bullets — within bounds: YES / NO." If any FR is over 12: apply the FR Size Management sequence from reference-tables.md before saving. — YES/NO
- [ ] Implementation Notes: every Implementation Note blockquote has 4 sentences or fewer. State count for any note with more than 2 sentences. — YES/NO
- [ ] State the document word count: "Sections 1–9 total: ~[N] words. Ceiling for [Complexity]/[Size]: [range] words. Within ceiling: YES / NO." Do not mark YES without stating the count.
- [ ] Every item in Section 8 Known Limitations reflects confirmed feature scope — no items from stages where scope was narrowed. YES/NO
- [ ] Appendix A/B consistency: re-apply the routing check one final time against the complete document. Confirm: (a) if the routing check fires for A, Appendix A header and at least one data row exist in the document AND the Section 6 callout references Appendix A; (b) if the routing check fires for B, Appendix B header and at least one data row exist AND the callout references B; (c) if the routing check does not fire for A, no Appendix A header appears anywhere in the document; (d) if the routing check does not fire for B, no Appendix B header appears. State each condition: "A routing fires: YES/NO. A content present: YES/NO. B routing fires: YES/NO. B content present: YES/NO." — Overall YES only if all four conditions are consistent.

If any item is NO: fix before saving. Do not save the file with a NO item outstanding.

---

## Save Document

**Path:** `_runs/[run-name]/Generated/Internal/Feature-Requirements-[Feature].md`

## State File Update

- `current_task` → `"stage7b"`
- `stages_completed` → add `"stage7b"`
- `artifacts.stage7` → final document path