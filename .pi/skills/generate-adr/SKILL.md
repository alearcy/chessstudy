---
name: generate-adr
description: Use when the user wants to document a cross-cutting architectural decision, a new dependency, a tradeoff, or a change in strategy. Invoked with /generate-adr.
user-invocable: true
argument-hint: [topic or brief description of the decision]
---

Run this skill in a subagent to keep the main session context clean.

Draft an Architecture Decision Record for: `$ARGUMENTS`

Follow these steps:

1. Read all existing ADRs in `docs/adr/` to:
   - Determine the next sequential ADR number (e.g., if ADR-003 is the latest, use ADR-004).
   - Check whether a related or conflicting ADR already exists. If one does, flag it and ask
     the user whether to create a new ADR or supersede the existing one.

2. Read `.claude/skills/generate-adr/template.md` to use as the output structure.

3. Read `TASKS.md` to identify any tasks that are related to or affected by this decision.
   Note their IDs — they will be referenced in the ADR.

4. Read any specs in `docs/specs/` that are directly relevant to the architectural question.

5. Draft the ADR as a new file in `docs/adr/` named `ADR-<NNN>-<short-kebab-description>.md`.
   Fill every section deliberately:
   - **Context:** Describe the problem, the constraints, and what triggered this decision.
     Be specific — vague context produces vague ADRs.
   - **Considered options:** List at least two realistic alternatives. For each option, provide
     a one-sentence summary of its main tradeoff. Never list only one option.
   - **Decision:** State what was chosen and the primary reason. Be honest about tradeoffs —
     do not oversell the chosen option.
   - **Consequences — Positive:** Concrete benefits expected from this decision.
   - **Consequences — Negative:** Downsides, risks, or constraints accepted. Do not omit these.
   - **Related specs / tasks:** Link task IDs from `TASKS.md` and spec files from `docs/specs/`
     that are affected by this decision.

6. Set the ADR status to `Proposed` unless the user explicitly states it is already agreed upon,
   in which case set it to `Accepted`.

7. Add an **Open questions** section at the end for anything ambiguous or unresolved.
   Never invent answers — flag them so the user can decide.

8. After generating, present the draft to the user and ask them to:
   - Review and confirm the content.
   - Confirm the status (Proposed → Accepted if already decided).
   - Confirm whether any existing ADR should be marked as `Superseded` by this one.
   Only write the file after the user approves the draft.

9. If any task in `TASKS.md` is directly impacted by this decision, remind the user to update
   those tasks or their specs to reference the new ADR number.
