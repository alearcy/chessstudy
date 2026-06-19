---
name: task
description: Use when the user asks to work on a task, start a new feature, pick a task from TASKS.md, implement something, or when you recognize that a task from TASKS.md needs to be started. Also triggers when the user says things like "lavoriamo su", "iniziamo", "prossimo task", "next task", "work on", "let's start", "implement".
user-invocable: true
argument-hint: [task name or number]
---

# Task Workflow — Step Mandatory Process

You MUST follow these steps in order. Do NOT skip any step.

## Step 1 — Read TASKS.md

Check pending tasks in `./TASKS.md`.

## Step 2 — Pick ONE task

Select the next logical task, or ask the user which one. If `$ARGUMENTS` is provided, use it to identify the task.

## Step 3 — Create a feature branch

Following GitFlow:

- Ensure no other feature branch exists and no files need to be committed/staged
- **Ask the user before creating the branch, committing, or staging**
- Create: `feature/<task-slug>` (e.g. `feature/product-catalog`)

## Step 4 — Check architectural decisions

If the task involves architecture:

- Read `docs/specs/` for existing specs on similar topics
- Read `docs/specs/` for architectural consistency
- Don't contradict past specs without explicitly acknowledging the change

## Step 5 — Plan

Use `EnterPlanMode` to create the implementation strategy:

- Keep it concise and focused on the current task only
- Include technical details: API routes, data models, workflow steps, conventions
- Do NOT plan for future tasks

## Step 6 — Create spec

Once the user accepts the plan:

- **Immediately** create `docs/specs/<task-name>.md` with the planned technical details
- This serves as decisions documentation for future reference

## Step 7 — Check existing tech debt

Before implementing, read all files in `docs/tech-debt/` and check if any open debt item is relevant to the current task:

- If a related item exists → surface it to the user and ask: "C'è un item di debito tecnico correlato. Vuoi risolverlo ora nell'ambito di questo task?"
- If yes → include the resolution in the implementation plan
- If no → proceed, but reference the debt file in any code that touches the workaround


## Step 8 — Implement with TDD (and surface tech debt)

For ALL feature implementation:

1. **RED** — Write tests FIRST that fail
2. **GREEN** — Implement the minimum code to pass tests
3. **REFACTOR** — Clean up while keeping tests green

Never implement first and write tests after.

If during implementation a workaround, stub, missing dependency, or TODO is encountered → **immediately invoke the `/find-tech-debt` skill** before continuing.

## Step 9 — Update tracking

- Update `TASKS.md` with progress
- Add discovered subtasks if any
- **TASKS.md format rules:**
  - **In Progress**: move the task title only (no description, no checkbox) under `## In Progress`
  - **Completed**: move the task title only (no description, no checkbox) under `## Completed`
  - **Todo**: pending tasks keep their full description with `- [ ]` checkbox
  - A task's full description lives in its spec (`docs/specs/<task-name>.md`), not in TASKS.md tracking sections

## Step 10 — Subtask completion

Always ask before moving to the next subtask:

- If the user wants to review → pause and wait
- If they want to move on → commit, clear context, proceed

## Step 11 — Task completion

When all subtasks are completed:

1. Check with the user for confirmation
2. Mark the parent task as completed in `TASKS.md`
3. Commit and push the feature/hotfix branch

## Critical rules to follow

**DO NOT:**

- Complete entire TASKS.md without asking
- Work on multiple tasks simultaneously
- Skip asking between tasks
- Assume user wants everything done at once

**User controls:**

- Which task to work on next
- When to pause and review
- When to continue
- Implementation pace and priorities

**When unclear:**

- STOP and ask for clarification
- Present tradeoffs when multiple valid approaches exist
- Surface problems immediately
- Only change code relevant to the current task

## Definition of done
<!-- Define what "done" means for a task. Be explicit.
     Remove or add criteria based on your project's needs. -->
A task is done only if:
- the implementation matches the spec
- required tests pass
- required lint / typecheck pass
- no unrelated files were modified
- any workaround introduced is tracked in `docs/tech-debt/` via `/find-tech-debt`
- if an architectural decision was made, an ADR was created or updated in `docs/adr/` via `/generate-adr`
