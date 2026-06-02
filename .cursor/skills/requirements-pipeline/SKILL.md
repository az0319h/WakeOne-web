---
name: requirements-pipeline
description: "A multi-stage discovery and analysis pipeline that takes messy, early-stage inputs — rough ideas, transcripts, designs, legal docs — and produces a near-ready internal requirements document. Handles brainstorming, scenario mapping, assumption analysis, user flows, and risk analysis with mandatory human checkpoints and a state file for resumable runs. Use when asked to: run the requirements pipeline, build requirements from scratch, start from rough ideas or a transcript, or work through a feature from discovery to requirements."
---

# Requirements Pipeline v2 — Orchestrator

## NON-NEGOTIABLE

1. **No fabrication.** Mark unknowns `[TBD]`, inferences `[INFERRED]`. Source every claim as `(Source: SRC-N, section)` or tag `(Source: Implicit)`.
2. **File first.** Save every artifact to disk before presenting in chat. Update the state file on every task transition and gate pass. Chat is ephemeral.
3. **WHAT not HOW.** Requirements describe the user-observable outcome — never the implementation mechanism or UI layout. If you catch yourself writing a HOW, reframe it as the underlying need.
4. **Four mandatory gates.** Stages 2, 3.5b, 5, and 9 do not advance until PM confirms: `stage2_confirmed`, `stage35_confirmed`, `stage5_confirmed`, `stage9_confirmed`. These gates are in the state file — check before proceeding.
5. **One stage at a time.** Read the stage file, follow its instructions completely, return here, advance to the next task in the table. Do not collapse stages.
6. **Two external call exceptions.** `transcript-to-meeting-notes` (Stage 1a) and `validate-requirements` (Stage 9) are the only external skill calls. All other sub-skill logic is inlined in stage files.

---

## T0-TN Task Table

The `current_task` field in the state file corresponds to the stage name in this table. On resume: read the state file, find `current_task`, look it up here, read the file.

| T# | Stage name | File | Runs in | Gate before advancing |
|---|---|---|---|---|
| T1 | stage1a | stages/01a-scoping.md | All | — |
| T2 | stage1b | stages/01b-quality-gate.md | All | — |
| T3 | stage2 | stages/02-interpretation.md | All | `stage2_confirmed` |
| T4 | stage3 | stages/03-brainstorm.md | All | — |
| T5 | stage35a | stages/03.5a-split-analysis.md | All | — |
| T6 | stage35b | stages/03.5b-mode-and-registry.md | All | `stage35_confirmed` |
| T6c | stage35c | stages/03.5c-execution-model.md | Split only — MANDATORY READ within T6 | — |
| T7 | stage4 | stages/04-scenarios.md | Standard / Full | — |
| T8 | stage5 | stages/05-assumptions.md | All | `stage5_confirmed` |
| T9 | stage6 | stages/06-user-flows.md | Standard / Full | — |
| T10 | stage7a | stages/07a-synthesize.md | All | — |
| T11 | stage7b | stages/07b-generate.md | All | — |
| T12 | stage8 | stages/08-risk-analysis.md | All | — |
| T13 | stage9 | stages/09-validation.md | All | `stage9_confirmed` |
| T14 | stage9c | stages/09c-reconciliation.md | Split only | — |

**Mode routing:** Express skips T7 (stage4) and T9 (stage6) — announced at T6 (stage35b). Standard and Full run all stages. Stage files for T7 and T9 have skip gates at their top that read `pipeline_mode` from the state file.

---

## State File Schema

Path: `_runs/[run-name]/.meta/pipeline-state.json`

Initialized at T2 (stage1b). Updated on every task transition and gate pass.

```json
{
  "skill": "requirements-pipeline",
  "run_id": "[YYYYMMDD]-[feature-slug]",
  "feature": "[feature name]",
  "pipeline_mode": "Express | Standard | Full",
  "is_split": false,
  "current_task": "stage1a",
  "stages_completed": [],
  "gates_passed": {
    "stage2_confirmed": false,
    "stage35_confirmed": false,
    "stage5_confirmed": false,
    "stage9_confirmed": false
  },
  "artifacts": {
    "stage1a": null,
    "stage1b": null,
    "stage2": null,
    "stage3": null,
    "stage35": null,
    "stage4": null,
    "stage5": null,
    "stage6": null,
    "stage7": null,
    "stage8": null,
    "stage9": null,
    "stage9c": null
  },
  "source_ids": [],
  "split_features": [],
  "quality_rating": null,
  "low_quality_acknowledged": false,
  "last_updated_utc": ""
}
```

`artifacts.stage35` holds the Stage 3.5b artifact path (Stage 3.5a overwrites it; Stage 3.5b overwrites it again — final value is the 3.5b path).
`artifacts.stage7` holds the Stage 7a synthesis path until Stage 7b overwrites it with the final document path.

---

## Folder Structure

Run folder created at T1 (stage1a) using: `_runs/[feature-slug]-[YYYYMMDD]/`

After split is confirmed at T5 (stage35a), folder is renamed to reflect feature names (e.g., `login` for single feature, `login+profile-security` for split). All artifact paths in the state file are updated on rename.

```
_runs/[run-name]/
├── .meta/
│   └── pipeline-state.json
├── source_summaries/          ← Processed inputs from Stage 1a
└── stage_output/
    ├── Stage1a-Scoping.md
    ├── Stage1b-Quality-Gate.md
    ├── Stage2-Interpretation.md
    ├── Stage3-Brainstorm.md
    ├── Stage3.5a-Split-Analysis.md
    ├── Stage3.5b-Mode-Registry.md
    ├── Stage4-Scenarios.md            (Standard/Full only)
    ├── Stage5-Assumptions.md
    ├── Stage6-User-Flows.md           (Standard/Full only)
    ├── Stage7a-Synthesis.md
    ├── Stage8-Risk-Analysis.md
    ├── Stage9-Validation-Report.md
    └── Stage9c-Reconciliation.md      (Split only)
```

Generated document path: `_runs/[run-name]/Generated/Internal/Feature-Requirements-[Feature].md`

For split runs, each feature gets its own subfolder under `stage_output/[Feature]/` for stages T7–T13.

---

## Pipeline Overview

```
T1 → T2 → T3 (gate) → T4 → T5 → T6 (gate)
                                     ↓
                  Express: T8 (gate) → T10 → T11 → T12 → T13 (gate)
                  Standard/Full: T7 → T8 (gate) → T9 → T10 → T11 → T12 → T13 (gate)
                                                                               ↓
                                                              Split only: T14
```

---

## Resume Protocol

If the pipeline was interrupted, read `_runs/[run-name]/.meta/pipeline-state.json`. The `current_task` field names the stage to resume. Look it up in the T0-TN table. Read the stage file and continue. Do not re-run completed stages — `stages_completed` is the source of truth.

If the run folder path is unknown, ask the PM for the run name before attempting to resume.

---

## Stage Routing

Each stage: read the file, follow all instructions, return here, update state file, advance to next T.

| T# | Read this file |
|---|---|
| T1 | `stages/01a-scoping.md` |
| T2 | `stages/01b-quality-gate.md` |
| T3 | `stages/02-interpretation.md` → STOP at gate |
| T4 | `stages/03-brainstorm.md` |
| T5 | `stages/03.5a-split-analysis.md` |
| T6 | `stages/03.5b-mode-and-registry.md` → STOP at gate; read `stages/03.5c-execution-model.md` if split confirmed |
| T7 | `stages/04-scenarios.md` (skip if Express) |
| T8 | `stages/05-assumptions.md` → STOP at gate |
| T9 | `stages/06-user-flows.md` (skip if Express) |
| T10 | `stages/07a-synthesize.md` |
| T11 | `stages/07b-generate.md` |
| T12 | `stages/08-risk-analysis.md` |
| T13 | `stages/09-validation.md` → STOP at gate |
| T14 | `stages/09c-reconciliation.md` (split only) |