# Reference Tables

> MANDATORY READ for `07a-synthesize.md` and `07b-generate.md`. Apply every rule in this file before generating any section of the output document.

---

## Writing Rules

### No Em Dashes
Never use — (em dash) anywhere in the document. Rewrite as two sentences or use a colon.

### No Semicolons
Never use ; to chain clauses. One idea per sentence.

### One Idea Per Sentence or Bullet

**Level 1 — Document-wide:**
Every sentence and every bullet in the document states one idea. If a sentence or bullet contains more than one outcome, behavior, or system state that a tester would verify separately — split it.

**Period-replacement test:** If you can replace "and" (or "while", "as", "so that") with a period and both halves stand as valid standalone statements, they must be split.

**What does NOT need splitting:**
- Temporal trigger + one outcome: "After selecting No, a comment field appears." — the trigger is not a separate outcome.
- Compound noun list: "The notification includes name, date, and comment." — one outcome, enumerated content.
- Conditional + one outcome: "If the comment field is empty, submission is blocked." — the condition is not a separate outcome.

**Level 2 — FR bullets (instance of Level 1):**
Each FR bullet states one observable outcome. Split compound statements into separate bullets.

❌ "The user taps the sign-in button, the device runs the biometric check, and the home screen appears on success."
✅ "The user taps the sign-in button to start the biometric check."
✅ "The home screen appears after a successful biometric check."

**Open Questions cell rule:**
7a extracts Open Questions raw from Stage 5. 7b has full authority to rewrite compound OQs — 7a's role is completeness, 7b's role is clarity.

Each Open Questions row states one primary question. If a follow-on question is related or conditional on the primary answer, write it as a sub-bullet under the primary — not as a new row and not as a second sentence in the same cell. Create a new row only when the follow-on topic is genuinely distinct or complex enough to stand on its own.

❌ "Is submission atomic or split across two calls? If split, what is the behavior when one call succeeds and one fails?"
✅ Question cell: "Is submission atomic or split across two calls?"
✅ Sub-bullet: "If split: what is the behavior when one call succeeds and one fails?"

### FR Bullets — User Flow Order
Bullets within each FR must follow the sequence a user experiences them — entry trigger first, outcome last. Mirror the flow from Stage 6.

### Overview Sentence Constraints
- 3–4 sentences only. Each sentence passes the period-replacement test — if "and" can be replaced with a period, split the sentence.
- Structure: problem → what the feature does → what changes → one key constraint (if relevant).
- Max 3 ideas per sentence.
- Write as a continuous paragraph. No blank lines between sentences. The four sentences read as connected prose, not a stanza or bullet list.

---

## Format Rules

### Tables vs. Bullets
Use a table when 3 or more columns each carry distinct, non-redundant information. Use bullets when content is a list of single items, one-per-line facts, or entries with fewer than 3 meaningful columns. Never use a table just because the content has two columns — a two-column table is usually a labeled list in disguise.

### Word Count Ceilings
Measure words in Sections 1–9 only. Exclude Section 10, Section 11, and all Appendix content.

| | Small (≤3 flows) | Medium (4–7 flows) | Large (8+ flows) |
|---|---|---|---|
| **Simple** | 300–600 | 600–1,000 | 1,000–1,500 |
| **Medium** | 700–1,200 | 1,500–2,500 | 2,500–3,500 |
| **Complex** | 1,200–2,000 | 2,500–4,000 | 4,000–6,000 |

If the document is over the ceiling, apply reductions in this order:
1. Remove duplicate rules that appear in multiple FRs — state the rule once in the first relevant FR only.
2. Move field-level specs and conditional branching to Appendix E. Add a callout line in the parent FR body.
3. Shorten Overview and Known Limitations to minimum sentences.

---

## FR Purity Rules

### WHAT vs. HOW
FR bullets describe what the user observes or what the system produces — not how the system achieves it. Any bullet that names an API call, database operation, internal state variable, OS callback, or evaluation algorithm is a HOW violation.

**Test:** Ask "Can a PM verify this in a demo without reading the code?" If no — it is a HOW.

❌ HOW: "The Login screen evaluates the user's stored sign-in preference against the device's current biometric enrollment state before rendering the sign-in button."
✅ WHAT: "The Login screen shows only the sign-in option that matches the user's configured preference and current device capabilities."

❌ HOW: "Tapping the button initiates the device's biometric authentication callback."
✅ WHAT: "The user signs in with a single tap when a biometric is enrolled on the device."

### Common HOW Patterns to Reject
- "The app calls / sends / queries / fetches / stores / reads..." → describe the result the user sees
- "The system sets [flag] to [value]..." → describe the behavior change the user observes
- "The OS returns a [callback / result]..." → describe what happens on screen next
- "On a [event name] event..." → describe the trigger as user action, not system event name

---

## FR Bullet Hierarchy Rule

Use one level of sub-bullets when a bullet describes a property, content, or constraint OF the outcome immediately above it — and only applies in that specific context.

**Parent-child test:** If the parent bullet were removed, would this bullet still stand as a meaningful standalone requirement? If no — sub-bullet. If yes — peer bullet.

The test applies to consecutive bullets only. A sub-bullet must be directly linked to the property, state, or content of the bullet immediately above it — not merely topically related to the same FR. If bullet N+1 is about the same topic as bullet N but would make sense under a different parent, it is a peer bullet.

**Use a sub-bullet for:**
- A property, content, or constraint that describes what the parent outcome IS, CONTAINS, or RESTRICTS — and has no meaningful standalone existence outside that parent. The sub-bullet is about the parent outcome itself, not what happens next.
- A constraint that clarifies one specific parent constraint and has no meaning without it.
- An exception that qualifies one specific parent bullet (not the whole FR).

**Stay top-level for:**
- Independent flow steps with their own trigger condition.
- Constraints that apply to the whole FR, not one parent bullet.
- Bullets related by sequence but not by parent-child dependency.

**NEVER use a sub-bullet for:**
- Sequential events — even when causally connected. "After A, B happens" describes two independently verifiable outcomes. Both stay flat regardless of causal connection.
- The next observable event after a trigger. Temporal adjacency is not parent-child dependency.

**Max depth:** One level only. If a sub-sub-bullet seems necessary, split the FR instead.

❌ Sequential nesting (wrong — both bullets are independent outcomes in sequence):
"After the user taps Submit, a confirmation message appears."
  - The list view updates to reflect the new entry.

✅ Sequential flat (correct — keep sequential outcomes as peer bullets):
"After the user taps Submit, a confirmation message appears."
"The list view updates to reflect the new entry after submission completes."

✅ Property nesting (correct — sub-bullets describe what the notification contains):
"The user receives a notification when their request is declined."
  - The notification includes the reviewer's reason for declining.
  - The notification includes instructions for resubmission.

❌ Flat (hides property hierarchy): "The submit button is not available while a session is active." / "The user must close the active session before the exit flow is accessible."
✅ Nested (shows property hierarchy): "The submit button is not available while a session is active." / "  - The user must close the active session before the exit flow is accessible."

---

## FR Boundary Rule

A separate FR is warranted only when a capability has an **independent user goal** — a goal that can be stated without referencing another FR.

**FR Independence Test:** Before creating a new FR Plan entry, ask: "Can this capability's purpose be described without mentioning another FR?" If no — it belongs inside the other FR as bullets or a branch, not as its own FR.

### Merge Patterns

**Pattern 1 — Start/End of the same capability → one FR**
When two flow steps represent entry and exit of the same user-initiated action, they share one user goal and belong in one FR. Start and End are sequential steps within the capability, not separate capabilities.

❌ Two FRs: "FR-N: User starts a timer" / "FR-M: User stops a timer"
✅ One FR: "Timer Recording: user starts and stops a timed activity." Start-step bullets first, end-step bullets follow.

**Pattern 2 — Constraint with no independent goal → bullets inside the parent FR, not a new FR**
When a behavior exists only to enforce a rule created by another FR — has no user goal of its own, and appears in the same flow context as the parent FR — it belongs as bullets inside the parent FR's content block, not as its own FR.

Test: (a) Remove the parent FR. Does the constraint FR still make sense as a standalone requirement? If no — not independent. (b) Does the constraint appear on a different screen or in a different flow context from the parent FR? If yes — it may warrant its own FR even if it fails test (a). Both conditions must be evaluated.

❌ Separate FR: "FR-N: Feature X is unavailable while action Y is active" — same flow, no independent goal
✅ Bullet inside the action-Y FR: "Feature X is not available while action Y is active."

Note: whether this bullet is a top-level peer or a sub-bullet is determined by the FR Bullet Hierarchy Rule at write time in 07b — not here. Do not force sub-bullet nesting during FR Plan construction.

**Pattern 3 — Approve/Deny branches of one decision → one FR with conditional syntax**
When an actor can take two opposing actions on the same object, both branches are the same capability. The user goal is one: act on a request. Write one FR; use conditional bullet syntax for diverging behaviors.

❌ Two FRs: "FR-N: Reviewer approves the request" / "FR-M: Reviewer denies the request"
✅ One FR: "Request Review: the reviewer can approve or deny. Denial requires a mandatory comment."

**Branch label format:** When merging two branches into one FR, use bold labels to separate branch behavior — do not write them as a flat undifferentiated list.

**[Branch A label]:**
- [bullet specific to Branch A]
- [bullet specific to Branch A]

**[Branch B label]:**
- [bullet specific to Branch B]
- [bullet specific to Branch B]

Labels are short and action-oriented: **Yes:** / **No:**, **Approve:** / **Deny:**, **Online:** / **Offline:**
Bullets shared by both branches appear above the bold labels as a preamble — not inside either section.

**Pattern 4 — Same implementation concern → one FR**
When two behaviors are triggered by the same user action under different conditions, affect the same data object, and a QA engineer would test them in a single test scenario, they belong in one FR. The distinction between them is technical, not user-visible.

Test: "Can a QA engineer test both behaviors in one test scenario by varying only the condition (e.g., online vs. offline, first submission vs. duplicate)?" If yes — one FR.

❌ Two FRs: "FR-N: System retries on connectivity failure" / "FR-M: Duplicate submission is silently discarded"
✅ One FR: "Submission Resilience: the feature handles connectivity failure and prevents duplicate records."

### When to Create a Separate FR

Split when all three are true:
1. The capability produces a distinct record type or record destination that no other FR produces, OR involves a distinct human actor, OR produces a distinct user-visible state that no other FR produces
2. The content results in 4–12 final bullets
3. Adding the content as a bold-labeled section to the nearest candidate FR would push that FR over 12 bullets

Additional split signals (any one of these is sufficient regardless of bullet count):
4. The capability has a different entry point or trigger that is not a sub-path of an existing flow
5. The capability involves distinct error handling or edge case behavior that warrants independent specification

**Actor separation (Rule 5):** A different human actor is always a split signal, regardless of bullet count — overrides condition (2). Automated system actions (no human initiates them) are not a distinct actor. An FR that mixes one human actor's submission flow with a different human actor's review flow must be split even if the combined bullet count is under 12.

### Branch Rules (Rule 4)

A branch earns its own FR when either condition is true:
- It has 5 or more bullets of its own behavior (not counting shared preamble), or
- It has a distinct error state that differs from the other path

Under both thresholds → bold label within the FR, not a separate FR.
**Rule 5 override:** actor separation always wins over the bullet count threshold.

### FR Size Bounds (Rules 2–3)

**Minimum — under 4 bullets:** Not a standalone FR. Route content to:

| Content type | Destination |
|---|---|
| Rule imposed by an external party | Section 9.1 Constraints |
| Pending decision requiring resolution | Section 10 Open Questions |
| Behavioral assumption accepted by the team | Section 9.3 Assumptions |
| Implementation detail with no user-visible outcome | Implementation Note blockquote |
| Behavior that extends the nearest FR | Bullets inside that FR |

**Maximum — over 12 bullets:** Apply in order before splitting:

Step 1 — Relocate. Move bullets to other sections using the table below. **Trim guard:** before removing a bullet, confirm the appendix covers the same state, same trigger condition, and same outcome — not merely the same general area. If not covered there, relocate using the table; do not delete.

| Bullet type | Destination |
|---|---|
| Hard constraint with a named owner | Section 9.1 Constraints |
| Pending decision or unresolved approval | Section 10 Open Questions |
| Behavioral assumption | Section 9.3 Assumptions |
| Implementation detail (how the system routes or stores) | Implementation Note blockquote |
| Named screen state (one of 3+ in the same FR) | Appendix A Visual States |
| Distinct error condition (one of 3+ in the same FR) | Appendix B Error Handling |

*Note: Appendix Routing Rules fire proactively during FR generation. This relocation table fires reactively when a Save Gate bullet count violation is found. Both target the same destinations — they work in layers, not as duplicates.*

Step 2 — Merge sequential bullets that share the same failure mode. Applies to consecutive bullets only. Merge A→B only when A and B cannot fail independently. Test: could a developer write a bug report where A succeeds and B fails? If yes — keep separate.

Step 3 — Fold sub-bullets. A sub-bullet with one qualifying clause and no distinct failure mode becomes a sentence appended to the parent bullet, if it passes the One Idea Per Sentence test.

Step 4 — Split, using When to Create a Separate FR. Document the split reason above the new FR heading. Split at a natural actor or state boundary, not at the lowest bullet count.

### Implementation Note Cap (Rule 8)

An Implementation Note blockquote is capped at 4 sentences. Longer content belongs in a separate technical spec.

### FR Count Signal
After building the FR Plan (Standard/Full mode only — skip when Stage 6 was not run), check: does the FR count exceed 2× the number of UF-N flows from Stage 6? If yes — scan the FR Plan for merge candidates using Patterns 1–4 before finalizing. This is a signal, not a hard cap. A high FR:flow ratio indicates over-splitting; investigate before proceeding.

---

## Appendix Routing Rules

| Route to Appendix | When |
|---|---|
| **A — Visual States** | A section of a FR has 3 or more named screen states with distinct user-visible differences |
| **B — Error Handling** | 3 or more distinct error conditions with different recovery paths for a single flow |
| **C — Audit Trail** | The feature creates, modifies, or reads an audit record at any point |
| **D — Detailed User Flows** | A flow has more than 4 decision branches or sub-paths that would make Section 6 unreadable |
| **E — Field-Level Specs** | A FR has conditional logic or validation rules that require 4 or more bullets to specify |
| **F — Full Risk Register** | §9.2 has more than 4 risks after sorting by Impact |
| **G — Open Questions** | Any open question with Medium or Low priority |

**Callout rule:** Every FR that routes content to Appendix E must include this line in its body:
`> See Appendix E: [rule name]`
No callout = no routing. Keep the content inline until a callout exists.

Same rule applies to Appendix F: if the §9.2 routing rule fires and Appendix F is created, §9.2 must contain `> See Appendix F: Full Risk Register` as its last line — or revert all overflow risks to §9.2.

---

## Platform Purity Rule

If a FR contains platform-labeled sections (`**[Platform]:**`), each section must use only terminology native to that platform. Do not reference a trademark, system API name, or UI pattern from one platform inside another platform's labeled section.

**Test:** Read each labeled section in isolation. Does every term in it naturally belong to that platform? If a term requires qualification ("... which is the X equivalent of..."), it is in the wrong section.

---

## Section Boundary Rules

These rules prevent HC/DEP/OQ contamination in Section 9.

| Content type | Correct location |
|---|---|
| Delivery dependency (another team, service, or artifact must be ready first) | Section 9.1 Constraints — as a bullet: "[Dependency name] must be ready before [milestone]. ([Imposing party])" |
| Assumption that could change feature behavior if wrong | Section 9.3 Assumptions — one row per assumption |
| Hard constraint imposed by an external party | Section 9.1 Constraints — with imposing party in parentheses |
| Risk that could derail delivery or harm users | Section 9.2 Risks — one row; "What goes wrong → user impact" in the Risk cell |
| Unresolved decision blocking design or dev | Section 10 Open Questions — Critical/High only; Medium/Low → Appendix G |

**Section 9 contamination check:** Before saving, confirm that no row in Section 9.1, 9.2, or 9.3 is actually an open question in disguise. The test: does the item describe something unknown that requires a decision? If yes — it is an open question, not a constraint, risk, or assumption.