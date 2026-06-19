---
name: generate-spec
description: Use when the user wants to generate a technical specification for a task, using the project's spec template. Invoked with /generate-spec.
user-invocable: true
argument-hint: [TASK-ID or task description]
---

Run this skill in a subagent to keep the main session context clean.

Generate a technical specification for: `$ARGUMENTS`

Follow these steps:

1. Read `TASKS.md` and locate the task matching `$ARGUMENTS`.
   If no matching task exists, ask the user whether to create one.

2. Read `docs/specs/TEMPLATE.md` to use as the output structure.

3. Read existing ADRs in `docs/adr/` that may be relevant to the task.

4. Draft the spec as a new file in `docs/specs/` named `<TASK-ID>-<short-description>.md`.
   Fill every section from the template. For each section:
   - **Business goal:** one sentence, focused on the user/business outcome.
   - **In scope / Out of scope:** be explicit about boundaries to prevent scope creep.
   - **Functional requirements:** numbered, each describing one observable behavior.
   - **Non-functional requirements:** only include what is relevant (performance, security, etc.).
   - **Data / contract impact:** list DB, API, or integration changes. Write "None" if no impact.
   - **Validation rules:** input constraints and business rules to enforce.
   - **Expected tests:** concrete test descriptions, not generic ("unit: validates email format", not "unit: validation").
   - **Acceptance criteria:** checkable conditions that prove the task is complete.

5. Add an **Open questions** section at the end. List anything that is ambiguous or
   missing from the task description. Never invent answers — flag them for the user.

6. After generating, ask the user to review and confirm before linking it in `TASKS.md`.
