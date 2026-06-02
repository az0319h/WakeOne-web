# Feature Requirements — [Feature Name]

**Pipeline Mode:** [Express / Standard / Full] | **Complexity:** [Simple / Medium / Complex] | **Size:** [Small / Medium / Large]
**Version:** 1.0 | **Status:** Draft | **Last Updated:** [YYYY-MM-DD]

> **MANDATORY READ before generating:** `reference-tables.md` → "Writing Rules" and "Format Rules" — apply all rules there before writing any section.

---

## 1. Overview
[3–4 sentences. Problem → what the feature does → what changes. One key constraint if relevant. See reference-tables.md Writing Rules for sentence constraints.]

## 2. Personas

| Persona | Description | Primary Need |
|---|---|---|
| | | |

*Max 3 rows. Overflow: "Additional personas receive identical experience — see Appendix."*

## 3. User Goals

| As a... | I want to... | So that... |
|---|---|---|
| | | |

## 4. Scope

**In Scope:** [one capability per bullet]
**Out of Scope:** [one item per bullet]

## 5. What's Changing
*Omit for net-new features.*

| Today | After this release |
|---|---|
| | |

## 6. User Flows
[One sentence intro.]

| Flow | Actor | Entry Point | Outcome |
|---|---|---|---|
| | | | |

*Visual states and error handling: see Appendix A and B. (include only if Appendix A or B routing rule fires — see reference-tables.md)*

## 7. Functional Requirements

> FR headings = `###`. Bullets ordered by user flow sequence. One outcome per bullet. No internal tracking tags (R-x, A-x, OQ-x). Platform groups: `**[Platform]:**` labeled bullet groups within the same FR. See reference-tables.md Format Rules.

### FR-1: [Capability Name]
[Description — one sentence, Complex FRs (4+ bullets with conditionals) only.]
- [First outcome in flow sequence]
- **[Platform A]:** [Platform A-specific behavior]
- **[Platform B]:** [Platform B-specific behavior]
> **Implementation Note:** [One sentence — only when a specific approach is required.]
*> See Appendix E: [rule name]* ← include only if bullets were moved to Appendix E

## 8. Known Limitations
**[Highest-impact limitation in bold.** One sentence on officer impact.]
- [Second limitation — one sentence]
- [Third limitation — one sentence]
*Max 3 items. Overflow to Appendix.*

## 9. Constraints, Risks & Assumptions

### 9.1 Constraints
- [One per bullet. Imposing party in parentheses if not obvious. Include dependencies as bullets if they impose constraints on delivery.]

### 9.2 Risks
| Risk | Impact | Mitigation |
|---|---|---|
| [What goes wrong → officer impact] | Critical / High / Medium | [Action or OQ-N reference] |
*Max 4 rows. Higher impact first. Overflow → Appendix F.*

### 9.3 Assumptions
| Assumption | Risk if Wrong |
|---|---|
| [Falsifiable statement] | [Consequence] |
*Max 5 rows. Higher risk first.*

## 10. Open Questions
| Question | Owner | Priority | Target Date |
|---|---|---|---|
| | | Critical / High | |
*Medium/Low → Appendix G.*

## 11. References
**Design Assets:**
- [Screen or component label]: SRC-N ([filename or URL])
*(One bullet per asset. Label describes what the asset shows — not the filename. Write "None" if no design assets.)*

**Source Materials:**
- SRC-N: [Document name]

---

## Appendices

**A — Visual States** *(if applicable — 3+ named screen states with distinct user-visible differences in any FR)*: `| State | What officer sees | Notes |`
**B — Error Handling** *(if applicable — 3+ distinct error conditions with different recovery paths in a single flow)*: `| Condition | What officer sees | Recovery |` *(3 columns only — no Cause column)*
**C — Audit Trail Lifecycle** *(if applicable)*
**D — Detailed User Flows** *(if applicable)*
**E — Field-Level Specs** *(if applicable — label each group: **From FR-N: [FR Title]**; every FR-N here needs a callout in its body)*
**F — Full Risk Register** *(if §9.2 has more than 4 risks — 6-column format: Risk ID | Description | Probability | Impact | Owner | Mitigation; callout required in §9.2 body)*
**G — Medium/Low Open Questions** *(if applicable)*