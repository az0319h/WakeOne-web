# Stage 6: User Flows

> **Skipped for Express mode.** If `pipeline_mode` in the state file is `Express`, stop here and proceed to Stage 7a.

---

## Position 0: Purity Filter — Read Before Drafting Any Flow

Apply this classification inline as you draft each flow card element. Do not draft first and filter later.

| Classification | Definition | Action while drafting |
|---|---|---|
| **REQUIREMENT** | What the system must enable — observable, testable, solution-free, user-outcome language | Keep |
| **SOLUTION** | How the system achieves it — implementation mechanism (cache, retry, backoff) | Move to System Scope zone; reframe the underlying need as a requirement |
| **DESIGN** | What it looks like — UI layout, navigation pattern, visual structure | Move to System Scope zone or flag as `[DESIGN: TBD]`; reframe the underlying need |
| **LANGUAGE** | Requirement scoped correctly but written in system/engineer language | Rewrite before writing the bullet |

Six language anti-patterns to catch and rewrite inline:
1. System-as-subject: "The system validates and submits" → describe what the user sees
2. Technical name in outcome: API name, endpoint, protocol → what the user experiences
3. Process verb: "fetches," "queries," "syncs," "polls," "caches" → what appears or becomes available
4. Passive navigation: "user is navigated/redirected to" → "[screen] appears"
5. Protocol or framework name: "OIDC flow," "OAuth token" → the user-visible effect
6. Internal state as outcome: "session is active," "record state PENDING" → what the user observes

## Position 0: Persona Synthesis Rules — Read Before Drafting Any Flow

While drafting flows, collect all actors who appear with a distinct trigger or distinct outcome. At the end of Stage 6, synthesize these into the Persona Table (direct source for Section 2 in the requirements document).

Rules for the final table:
- One row per actor with a distinct trigger or outcome. Compress actors sharing the same flow and outcome.
- Persona name reflects behavioral state — what the user has configured or what situation they are in. Never a platform name as the leading word.
- Cap at 3 rows. Actors beyond the cap: *"Additional personas receive identical experience — see Appendix."*

❌ "iOS officer" ✅ "Officer managing Face ID permission"

---

## Flow Inventory

Build this table first, before drafting any flow card:

| Flow | Actor | Trigger | Priority |
|---|---|---|---|
| UF-N: [Name] | [Actor] | [Situation the user is in — not the system event] | Critical / Important / Nice-to-have |

**Trigger column:** Write from the user's perspective. "User opens the app and isn't signed in" not "App opened with no valid session."

**Ordering principle** — flows should read as a user story, not a state machine:
1. Happy paths — most common first
2. Lifecycle transitions — sign-out, session end, return visit
3. System gates — conditions checked before access
4. Edge cases and failure modes

## Flow Card Format

Each flow is a Narrative Flow Card — four zones, fixed order. No tables except the Flow Inventory above.

```
## UF-N: [Flow Name]
**Who:** [Actor] | **When:** [Situation — not the system event]
**Goal:** [One sentence — what the actor is trying to accomplish]

**What the user experiences**
- [Actor] [action]
  → [System response — user-visible only; background actions go to System scope]
- [Actor] [action]
  → [System response]

**What can go wrong**
- **[Condition]:** [What the system does — one line]

**System scope** *(technical reviewers)*
- [Background integrations, data writes, timer logic, notifications — not visible to user]
```

**Drafting rules:**
- Complete all four zones of one card before starting the next
- System scope zone: background actions only — nothing the user can see
- "What the user experiences": no implementation mechanisms, no technical names
- Steps with no visible system response have no `→` line

## Persona Table

Synthesize after all flows are drafted. Write this exact section heading to the artifact: `## Persona Table — Stage 6 Output`

| Persona | Description | Primary Need |
|---|---|---|
| [Behavioral-state name] | [Context — does not restate the persona name] | [What the user needs to achieve] |

This table is the direct source for Section 2 Personas in Stage 7. Stage 7 does not re-derive personas from Stage 3 actors.

---

## Save Stage 6 Artifact

**Path:** `_runs/[run-name]/stage_output/Stage6-User-Flows.md`

Structure: Summary Card → Flow Inventory → Flow Ordering Rationale → all Narrative Flow Cards → Persona Table

Summary Card:
```
## Summary Card — Stage 6: User Flows
**Feature:** [Name] | **Date:** [Date] | **Mode:** [Express / Standard / Full]

**Top 3:**
1. [Most complex flow — most failure modes or branching]
2. [Flow most likely to surface design gaps]
3. [Flow with the most user-visible error states]

**New vs. Stage 4:** [One sentence — flow count, purity filter reclassifications, design gaps found]

**PM review needed before Stage 7a:**
- [ ] [Flow with missing or unclear error path — as complete sentence, UF-N in parentheses]
```

## Checkpoint — Chat Output

```
Stage 6 complete. File: [path]

Flows: [N] total — [N] Critical | [N] Important | [N] Nice-to-have
Purity filter: [N] items reclassified inline
Persona table: [N] rows

Review and confirm to proceed to Stage 7a.
```

## State File Update

- `current_task` → `"stage6"`
- `stages_completed` → add `"stage6"`
- `artifacts.stage6` → file path