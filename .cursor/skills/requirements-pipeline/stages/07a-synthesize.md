# Stage 7a: Synthesis

> Prepares verified context for document generation. Runs before `07b-generate.md`. Do not begin generating the requirements document in this stage — synthesis and verification only.

---

## MANDATORY READ

Before any synthesis work:
1. Read `templates/feature-requirements-v2.md` — this is the output format contract. Every section header, table structure, and format rule defined there applies to the document 07b will generate.
2. Read `reference-tables.md` — all sections apply: Writing Rules, Format Rules, FR Purity Rules, Appendix Routing Rules, Platform Purity Rule, Section Boundary Rules.

**Load confirmation (required before Step 1):** Confirm you have read `reference-tables.md` by stating this exact sentence from the FR Purity Rules section: "Can a PM verify this in a demo without reading the code?" If you cannot quote this exactly from the file, stop and re-read the file before continuing.

---

## Step 1: Read All Stage Artifacts

Read the following in order. For each, extract only the items listed:

| Artifact | Extract |
|---|---|
| Stage 1b (Intake) | Feature name, confirmed pipeline mode, input quality rating, current state (CONFIRMED / UNKNOWN), source IDs; all SRC-N IDs with document names; design asset URLs if present |
| Stage 2 (Interpretation) | All STATED facts with source IDs; confirmed inferences (now STATED); [TBD] items |
| Stage 3 (Brainstorm) | New constraints (NC table only — not Stage 2 constraints); actor outcomes from the actor interaction map |
| Stage 3.5b (Mode/Registry) | Confirmed mode, Complexity, Size; Shared Registry (split runs: exclusion list and cross-references); confirmed In Scope and Out of Scope lists |
| Stage 4 (Scenarios) | Critical and Important scenarios only; any scenarios with `[TBD]` expected behavior |
| Stage 5 (Assumptions) | All assumptions by priority; all `[RECLASSIFY: ...]` items with their target sections |
| Stage 6 (User Flows) | Persona Table (source for Section 2); all flow cards — extract per card: (a) Flow title, primary actor, entry point, end-state outcome; (b) `**Goal:**` line and actor; SOLUTION items for Implementation Notes |

After reading all artifacts, write the following pre-staged blocks to this artifact before proceeding to Step 2:

**Persona Table (pre-staged for Section 2):** Copy the Stage 6 Persona Table verbatim.

```
## Persona Table (pre-staged for Section 2)
| Persona | Description | Primary Need |
|---|---|---|
| [row from Stage 6] | | |
```

**What's Changing Table (pre-staged for Section 5):** Copy the current-state vs. after-release table from Stage 1b verbatim. Omit this block entirely for greenfield features.

```
## What's Changing Table (pre-staged for Section 5)
| Today | After this release |
|---|---|
| [row from Stage 1b] | |
```

**Scope (pre-staged for Section 4):** Copy the confirmed In Scope and Out of Scope lists from Stage 3.5b verbatim.

```
## Scope (pre-staged for Section 4)
In Scope:
- [item from Stage 3.5b]

Out of Scope:
- [item from Stage 3.5b]
```

**User Goals (pre-staged for Section 3):** For each flow actor, pair the Stage 6 `**Goal:**` line with the matching actor outcome from Stage 3's actor interaction map. Do not write sentences — keep raw.

```
## User Goals (pre-staged for Section 3)
| As a... | I want to... | So that... |
|---|---|---|
| [actor] | [Goal: line as user intent] | [actor outcome from Stage 3] |
```

**User Flows (pre-staged for Section 6):** One row per UF-N. Values come directly from flow card header fields — no interpretation.

```
## User Flows (pre-staged for Section 6)
| Flow | Actor | Entry Point | Outcome |
|---|---|---|---|
| UF-N: [title] | [primary actor] | [trigger or entry condition] | [end state] |
```

**References (pre-staged for Section 11):** Read the source registry from the Stage 1b artifact (which includes the labeled source IDs from Stage 1a processing). Separate entries classified as `design image` or `Figma URL` into the Design Assets block. All other classified entries go into Source Materials. Use the label field recorded in the source registry for each design asset. If no label was recorded, write the filename as the label and append `— label missing, describe before handoff`.

```
## References (pre-staged for Section 11)
**Design Assets:**
- [Label from source registry]: SRC-N ([filename or URL])
[one bullet per design asset; if label missing: "[filename — label not captured]: SRC-N ([filename])"]
Write "None" if no design assets exist.

**Source Materials:**
- SRC-N: [Document Name]
[one bullet per document source — meeting transcripts, legal docs, briefs, existing requirements; exclude design images and Figma URLs]
```

**For Express runs:** Stage 4 and Stage 6 artifacts do not exist. Write these placeholder strings verbatim in the relevant pre-staged blocks:
- Persona Table: `[EXPRESS MODE — Stage 6 not run. Personas not documented for this pipeline run.]`
- User Goals: `[EXPRESS MODE — User flow goals not documented. Actor outcomes from Stage 3 only.]` — then list Stage 3 actor outcomes in the "I want to..." column
- User Flows: `[EXPRESS MODE — Stage 6 (User Flows) not run. User flows are not documented for this feature in this pipeline run.]`

## Step 2: Route Reclassified Stage 5 Items

Before generation, map each `[RECLASSIFY: ...]` item from Stage 5 to its target section:

| Reclassification | Target section in output document |
|---|---|
| Hard Constraint | Section 9.1 Constraints |
| Dependency | Section 9.1 Constraints (as dependency bullet with imposing party) |
| Open Question | Section 10 Open Questions |
| Known Limitation | Section 8 Known Limitations |

Do not carry these items into Section 9.3 Assumptions. If any `[RECLASSIFY: ...]` item appears in the assumptions list without routing, fix it before proceeding to 07b.

**Stage 3 NC routing — Phase A (Stage 5 cross-reference only):** For each NC item from the Stage 3 NC table, check whether it appears in the Stage 5 reclassification routing table above. Mark each NC as one of:
- `Routed via Stage 5: [item name]` — NC was reclassified and routed in Stage 5
- `Unrouted — pending FR Plan check` — NC does not appear in Stage 5 routing

Write Phase A results to artifact:

```
## NC Routing — Phase A (Stage 5 cross-reference only)
| NC | Description | Status |
|---|---|---|
| NC-N | [description] | Routed via Stage 5: [item name] |
| NC-N | [description] | Unrouted — pending FR Plan check |
```

Do not attempt to check if NCs are captured in the FR Plan at this step — the FR Plan does not exist yet. That check runs in Step 7 Phase B.

**Known Limitations pre-staging:** After routing RECLASSIFY: KL items, apply the OQ-exclusion check before writing the pre-staged Section 8 list: scan the reclassification routing table for any item that appears in BOTH a KL routing row AND an OQ routing row. Any dual-tagged item belongs in Section 10 only — exclude it from the Section 8 pre-staged list. Write a note in the §8 block: `[Excluded from §8: [item description] — routed to §10 as OQ; pending decision is not a confirmed limitation.]` Then write the pre-staged list. Sort by officer impact first, delivery-only second. Bold the highest-impact item. Keep raw — one short clause per bullet, no sentences.

```
## Known Limitations (pre-staged for Section 8 — Stage 5 only)
**[Highest-impact limitation — officer impact stated plainly.]**
- [Second limitation]
Note: Stage 8 Known Limitations pending — update after Stage 8 completes.
```

**Assumptions pre-staging (Section 9.3):** List every Stage 5 assumption that was NOT reclassified. These are the only items that belong in Section 9.3. Extract full text — Assumption statement, Risk if Wrong, Priority. Sort by risk (highest first). Max 5 rows.

```
## Assumptions (pre-staged for Section 9.3)
| Assumption | Risk if Wrong | Priority |
|---|---|---|
| [statement from Stage 5 — not reclassified] | [risk statement] | HIGH / MEDIUM / LOW |
```

**Open Questions pre-staging (Section 10):** For each OQ routed to Section 10 in the reclassification table, extract full content from Stage 5. Include only Critical and High priority OQs here. Medium/Low OQs route to Appendix G — note them separately.

```
## Open Questions (pre-staged for Section 10)
| Question | Owner | Priority | Target Date |
|---|---|---|---|
| [question text from Stage 5] | [owner] | Critical / High | [date or TBD] |

Appendix G routing: [list Medium/Low OQs by description — or "None"]
```

## Step 3: Route Stage 6 SOLUTION Items

Each SOLUTION item identified by the Stage 6 Purity Filter must appear as an `> **Implementation Note:**` callout in its corresponding FR. Map each SOLUTION item to its target FR now — this mapping is consumed in Step 7 when building FR content blocks.

| SOLUTION item | Target FR | Implementation Note text |
|---|---|---|
| [Stage 6 SOLUTION description] | [FR-N] | [one sentence — user-observable impact of this implementation choice] |

If a SOLUTION item cannot be mapped to any FR, assign it to the FR covering the most closely related behavior. Do not leave any SOLUTION items without a home.

## Step 4: Source Verification Pass

For each STATED fact that will appear as a sourced claim in the requirements document:
- Verify the cited source actually contains the claimed information
- Flag over-generalizations: if the source says "X in context A," the requirement must not state "X in all contexts"
- Tag unverifiable claims: `[SOURCE UNVERIFIED — SRC-N does not contain this claim]`
- Review all `(Source: Implicit)` items: is this a logical derivation, or a gap-fill that should be `[TBD]`?

For any STATED fact that is a direct quote, a specific data value, or a claim you are uncertain about — re-read the original source document (Tier 1 input from `source_summaries/`) directly. Stage 2 processing may have introduced distortions. Do not verify against Stage 2 STATED list alone. Tag any claim verifiable only via Stage 2 (not original source) as `(Source: Stage 2 derivation — original not re-verified)`.

Assign each STATED fact one of three verification tags — these tags carry forward into Step 7 content blocks:
- `verified` — confirmed against original source document
- `Stage 2 derivation — not re-verified` — only confirmable via Stage 2; original source not re-read
- `SOURCE UNVERIFIED` — source does not contain this claim

Surface any unverified claims to the PM before proceeding to 07b. A claim tagged `SOURCE UNVERIFIED` is either a `[TBD]` or must be removed.

## Step 5: Phase 2/3 Check

Scan Stage 3–5 artifacts for any items explicitly deferred to a later release. If deferred items exist:
- Note them — they become `*(Phase 2/3)*` FR entries in Stage 7b
- After Stage 7b generates the document, these FRs will be extracted to a sibling `Phase-2-3-Requirements-[Feature].md` document

## Step 6: Overview Fact Clustering

Scan all STATED facts from Stage 2 and tag each by its Overview slot. A slot holds 2–4 facts — not one. Do not write sentences here; keep facts raw with source citations.

| Slot | Filter criteria |
|---|---|
| Problem | Facts about the current-state gap, actor pain, or missing capability |
| Feature | Facts about what MyConnect adds in this release |
| Change | Already pre-staged in What's Changing table — pointer only, no new selection needed |
| Constraint | Single most binding top-level constraint (delivery date, legal mandate, or Phase 1 scope limit) |

Facts that fit no slot are not Overview material — exclude them from this block.

Write to artifact:

```
## Overview Fact Clusters (pre-staged for Section 1)
Problem: [fact — source: SRC-N] | [fact — source: SRC-N] | ...
Feature: [fact — source: SRC-N] | [fact — source: SRC-N] | ...
Change: see What's Changing table (pre-staged above)
Constraint: [fact — source: SRC-N] | [fact — source: SRC-N] | ...
```

## Step 7: FR Plan and Coverage Check

**Step 7 Pre-Build: FR Independence Check**

Before writing any FR content block, identify all FR candidates from the source artifacts (Stage 2 STATED facts, Stage 3 NCs, Stage 4 scenarios, Stage 6 flow cards). For each candidate, apply the FR Independence Test and Merge Patterns from reference-tables.md:

1. FR Independence Test: "Can this capability's purpose be described without referencing another FR?" If no — do not create a new entry; merge into the referenced FR.
2. Scan Merge Patterns 1–4. If a candidate matches any pattern, apply the merge action:
   - Pattern 1 (Start/End): combine into one FR entry. Start-step source bullets first, end-step bullets follow.
   - Pattern 2 (Constraint-only, same flow context): remove the candidate entry; add its source content as additional source bullets in the parent FR's content block. The FR Bullet Hierarchy Rule in reference-tables.md governs whether they nest as sub-bullets at write time — do not force nesting here.
   - Pattern 3 (Approve/Deny): combine into one FR entry. Group source bullets by branch using inline branch labels (e.g., `[Approve:]` / `[Deny:]` or `[Yes:]` / `[No:]`) as a prefix on each branch-specific source bullet. Shared preamble bullets carry no prefix. 07b converts these prefixes to bold labels when generating the FR — see branch label format in reference-tables.md.
   - Pattern 4 (Same concern): combine into one FR entry with a title covering both concerns.
3. After merges, finalize the ordered list of FR entries before proceeding to write content blocks.
4. Count source bullets for each planned FR entry. Apply size bounds from reference-tables.md:
   - Under 4 source bullets: not a standalone FR. Fold using the Under-4 routing table in reference-tables.md FR Size Bounds.
   - 4–10 source bullets: correct size. (Ceiling of 10 source bullets — 07b may split compound bullets during generation; 10 source ≈ 12 final.)
   - Over 10 source bullets: add flag `[SIZE: [N] source bullets — apply FR Size Management at 07b]` to the FR content block header. Warning for 07b — not a blocker for plan finalization.

**FR count check:** After merges, count final FR entries. Compare to UF-N flow count from Stage 6 (Standard/Full mode only — skip for Express). If FR count > 2× UF-N count, re-scan for merge candidates before proceeding.

Express mode: Stage 6 not run — no UF-N count available. Skip ratio check. Note in synthesis context: `FR count: [N] FRs | Express mode — UF-N comparison not applicable.`

**Build the FR Plan.** This is the primary synthesis output for Section 7 — it embeds source content per FR so 07b writes bullets without reading any Stage 1–6 artifact directly. One content block per FR, ordered by user flow sequence.

**FR content block format:**

```
**FR-N: [Title]** | Appendix: [letter or "None"] | Flow position: [UF-N or "No UF"]
- [Source ID] ([verification tag]): [content]
- [Source ID] ([verification tag]): [content]
> **Implementation Note:** [text from Step 3 SOLUTION mapping — include only if this FR has a mapped SOLUTION item; omit line entirely if not]
```

**Source ID format:** `SRC-N §section`, `NC-N`, `S-N`, `UF-N step N`, `A-N (PM clarification YYYY-MM-DD)`

**Verification tag:** carry the tag assigned in Step 4. One of `verified`, `Stage 2 derivation — not re-verified`, or `SOURCE UNVERIFIED`. Do not omit the tag on any bullet. A bullet tagged `SOURCE UNVERIFIED` must be written as `[TBD — source not confirmed]` in the content block, not as a fact.

**Content extraction rules:**
- Exact wording for direct quotes, data values, and named rules
- Close paraphrase acceptable for narrative descriptions — do not over-generalize (if source says "X in context A," content must not say "X always")
- From Stage 6 flow cards: extract the specific step or trigger text that maps to this FR's behavior, not the full flow narrative
- One bullet per distinct fact or constraint — do not bundle two facts into one bullet

**Implementation Note:** After the last source bullet for each FR, check the Step 3 SOLUTION mapping table. If this FR has a mapped SOLUTION item, add the Implementation Note line exactly as written in Step 3. If no SOLUTION item applies, omit the line entirely.

Every FR must have at least one source bullet. FRs with no traceable source are fabrication — remove them.

**NC Routing — Phase B (FR Plan cross-reference):** After all FR content blocks are written, return to the Phase A NC routing table from Step 2. For each NC marked `Unrouted — pending FR Plan check`: check whether that NC's content appears as a source bullet in any FR content block. Update the status:
- Found in FR content block — update to `Captured in FR-N: [FR title]`
- Not found — update to `Unrouted: add to Section 9.1`. Determine whether it is a constraint or dependency, note the imposing party, and add it to the Section 9.1 routing result.

After Phase B, compute the final NC routing summary:
`Stage 3 NC routing: [N] captured in FRs | [N] routed via Stage 5 | [N] added to 9.1`

**Run STATED fact coverage check.** After all FR content blocks are written, verify every STATED fact from Stage 2 has a home:
- **Covered** — appears as a source bullet in at least one FR content block
- **Routed** — reclassified to 9.1, 9.3, 8, or 10 in Step 2
- **Uncovered** — neither Covered nor Routed

Uncovered HIGH or MEDIUM STATED facts — flag as `[COVERAGE GAP — S-N: brief description]`. Any unresolved HIGH COVERAGE GAP — set `Ready to generate: NO`.

**Run scope-FR alignment check.** For each item in the Stage 3.5b In Scope list, confirm at least one FR content block covers it. Flag unmatched items as `[SCOPE GAP]`.

Record all three results in the synthesis context (Step 8).

## Step 8: Synthesis Context

Write a synthesis context in the Stage 7a artifact. 07b reads this block as its primary input — do not proceed to 07b until it shows `Ready to generate: YES`.

```
## Synthesis Context — Stage 7a
Feature: [name] | Mode: [Express/Standard/Full] | Quality: [HIGH/MEDIUM/LOW]
(if LOW: ⚠️ PM acknowledged LOW confidence — high proportion of (Source: Implicit) expected)
Current state: [CONFIRMED (SRC-N) / CURRENT STATE UNKNOWN]
Complexity: [Simple/Medium/Complex] | Size: [Small/Medium/Large]

Verified STATED facts: [N] (sources confirmed)
[RECLASSIFY] routing: [N HC → 9.1] [N DEP → 9.1] [N OQ → 10] [N KL → 8]
Stage 3 NC routing: [N] captured in FRs | [N] routed via Stage 5 | [N] added to 9.1
SOLUTION items mapped: [N] → Implementation Notes
[TBD] items: [N critical] [N important] — list them
Unverified claims: [N] — list each with tag or note resolution
STATED fact coverage: [N] Covered | [N] Routed | [N] Uncovered
Coverage gaps (HIGH/MEDIUM only): [none / COVERAGE GAP — S-N: description]
Scope-FR alignment: [N] of [N] In Scope items covered by FR Plan. Gaps: [none / list]
FR count: [N] FRs | [N] UF-N flows | ratio [N:N] — within bounds: YES / NO (Express: FR count [N] | UF-N comparison not applicable)

Ready to generate: YES / NO (if NO, list what must be resolved first)
```

Pre-staged blocks written to this artifact (07b reads directly — do not re-derive in 07b):
- Persona Table (Step 1 — Stage 6 extraction)
- What's Changing Table (Step 1 — Stage 1b extraction)
- Scope lists: In Scope + Out of Scope (Step 1 — Stage 3.5b extraction)
- Overview Fact Clusters (Step 6)
- User Goals table (Step 1 — Stage 6/3 cross-reference)
- User Flows table (Step 1 — Stage 6 extraction)
- Known Limitations bullets (Step 2 — Stage 5 KL items, sorted; OQ-excluded items noted)
- Assumptions table (Step 2 — non-reclassified Stage 5 assumptions, full text)
- Open Questions table (Step 2 — Critical/High OQs, full content)
- References (Step 1 — Stage 1a source registry; labeled Design Assets + Source Materials)
- FR Plan content blocks (Step 7 — per-FR embedded source content)

---

## Save Stage 7a Artifact

**Path:** `_runs/[run-name]/stage_output/Stage7a-Synthesis.md`

Include: synthesis context, all pre-staged blocks listed above, reclassification routing table, NC routing Phase A and Phase B results, SOLUTION-to-FR mapping table, FR Plan content blocks, list of any unverified claims resolved or escalated.

## State File Update

- `current_task` → `"stage7a"`
- `stages_completed` → add `"stage7a"`
- `artifacts.stage7` → Stage 7a synthesis artifact path (07b overwrites this with the final document path)