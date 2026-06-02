# Stage 1a: Input Scoping

> This stage locks the input set and assigns source IDs. All subsequent stages operate only on inputs confirmed here. Never scan the workspace without explicit user approval.

---

## Step 1: Establish Run Folder

Create the run folder at `_runs/[feature-slug]-[YYYYMMDD]/` with these subdirectories:
- `.meta/` — state file lives here
- `source_summaries/` — processed input outputs
- `stage_output/` — stage artifacts

Feature slug: lowercase, hyphens only (e.g., `login-biometric-2026-05-05`).

## Step 2: Three-Tier Scoping Gate

**Tier 1 — User-provided inputs (always included, no confirmation needed)**
All files, folders, URLs, and verbal descriptions provided by the user. If a folder is provided, all files within it are Tier 1.

List them:
```
Tier 1: [N] files + [M] URLs/verbal inputs
- SRC-[N]: [filename or URL]
```

**Tier 2 — Same-folder scan (present for selection)**
Glob only the parent folders of Tier 1 files. Do not recurse beyond those folders. Show discovered files grouped by type with modification dates. Ask the user to select which to include. Unselected files are never read.

**Tier 3 — Workspace-wide search (explicit opt-in only)**
After Tier 2 confirmation, offer: *"Would you like me to search the rest of the workspace for related files?"* Run only if the user accepts. Extract 5–10 key terms from Tier 1+2 inputs. Grep for them across the workspace. Present matches grouped by type with the matched term shown. User selects; unselected files are never read.

After all tiers, confirm the locked input set:
```
Final input set: [N] total inputs locked.
```

## Step 3: Load Project Context

If `project-context.md` exists in the workspace root, assign it `SRC-0` and read it. Announce in one line:
```
Project context loaded (SRC-0): [stack] | [N] personas | [N] known systems
```
If not found, proceed without it.

## Step 4: Assign Source IDs and Classify

Assign `SRC-N` to every input in the locked set. Classify each and assign a processing route:

| Input type | How to identify | Processing route |
|---|---|---|
| Meeting transcript | `.vtt`, `.md`, `.txt`, `.docx` with speaker names and timestamps | `transcript-to-meeting-notes` skill |
| Figma URL | `figma.com` URL | Subagent — full `design-to-context` instructions (see Step 5b) |
| Design image | `.png`, `.jpg`, `.fig`, screenshot | Read directly. After reading, record a descriptive label in the source registry: `SRC-N: [filename] → design image → Label: [what screen or component this shows]`. The label must describe what a developer sees on screen — not the filename. If the content is ambiguous or the image cannot be read, prompt the PM: *"What screen or component does [filename] show? (e.g., 'Clock Out sheet — Yes selected')"* Do not proceed until a label is recorded. For Figma URLs (Step 5b path): label comes from the design-to-context subagent return (file/node name from subagent output); no PM prompt needed. |
| Legal, policy, compliance doc | Regulatory language, formal constraints, thresholds | Read directly — extract rules and constraints |
| Existing requirements doc | Structured doc with Scope / FRs / Assumptions sections | Read as baseline |
| High-level brief, rough notes | Freeform text, verbal description in chat | Read directly |

Report the source registry:
```
SRC-1: [filename] → [type] → [route]
SRC-2: [URL] → [type] → [route]
```

## Step 5: Process Inputs

**5a — Transcripts:** Run the `transcript-to-meeting-notes` skill. Save the output to `source_summaries/`.

**5b — Figma URLs:** Launch a subagent with:
- The Figma URL and parsed `fileKey` / `nodeId`
- The full `design-to-context` skill instructions
- Save path: `source_summaries/[SRC-N]-design-context.md`
- Return instruction: file path, screen count, 3–5 design intent bullets only

**5c — All other inputs:** Read directly. No separate output file needed.

## Step 5a: Processing Verification Gate

Before proceeding to Stage 1b, verify every input that required processing has a saved output file:
```
- SRC-1: [filename] → ✅ Saved: [path]
- SRC-2: [Figma URL] → ✅ Saved: [path]
- SRC-3: [transcript] → ❌ NOT PROCESSED
```

If any shows ❌: run the route before proceeding.
If processing fails (Figma MCP unavailable, unreadable file): flag as `⚠️ COULD NOT PROCESS — [reason]. Citations to SRC-N will be unverifiable.` Show to PM and ask how to proceed before Stage 1b.

---

Continue to `01b-quality-gate.md`.