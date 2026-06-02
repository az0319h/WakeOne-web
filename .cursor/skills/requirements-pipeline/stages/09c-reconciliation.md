# Stage 9c: Post-Merge Reconciliation (ONLY if multiple features)

> Runs only when Stage 3.5 produced a split and multiple feature documents exist. Ensures the set of documents is consistent — not just individually correct.

---

## 9c.1 Cross-Document Deduplication

> Within-document dedup already ran in Stage 9 for each feature document. This stage focuses exclusively on cross-document duplicates.

For each pair of feature documents, check:
- **Duplicate assumptions:** Same assumption stated in two documents (even with different wording). Keep the one owned per the Shared Registry. Delete the duplicate and add a cross-reference.
- **Duplicate dependencies:** Same dependency row in two documents. Keep the one owned per the Shared Registry.
- **Duplicate open questions:** Same question asked in two documents. Keep the one owned per the Shared Registry.
- **Duplicate FR bullets:** Same business rule bullet appearing in two FRs across different features. Keep the rule in the owner feature; replace the duplicate with a cross-reference.

## 9c.2 Conflict Detection

Scan for:
- **Same rule, different wording:** Two features describe the same behavior using different language. Standardize to the primary feature's version.
- **Contradictory rules:** Two features state conflicting behavior for the same scenario. Flag for user resolution.
- **Inconsistent status:** An assumption marked Confirmed in Feature A but Not Confirmed in Feature B. Align to the most current status.

## 9c.3 Resolve [SHARED] Flags

During Stages 4–9, subagents may have flagged new items as `[SHARED — assign to Feature X]`. For each:
1. Confirm which feature should own it
2. Move it to the owning feature's document
3. Add cross-references in the other feature documents
4. Update the Shared Registry

## 9c.4 Add Cross-References

For every cross-reference placeholder ("See Feature A, Section N"), resolve to the actual section number in the final document. Verify the target section exists and contains the expected content.

## Save Stage 9c Artifact

**Path:** `_runs/[run-name]/stage_output/Stage9c-Reconciliation.md`

Include:
- Number of cross-document duplicates found and resolved (from 9c.1)
- Number of conflicts found (resolved + unresolved, from 9c.2)
- Number of [SHARED] flags resolved (from 9c.3)
- Number of cross-references added (from 9c.4)
- Any unresolved conflicts requiring user decision

**STOP and WAIT for PM to review.** If unresolved conflicts exist, the PM must decide before documents are finalized.

## State File Update

- `current_task` → `"stage9c"`
- `stages_completed` → add `"stage9c"`
- `artifacts.stage9c` → Stage 9c artifact path