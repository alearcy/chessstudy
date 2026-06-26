---
name: tech-debt
description: Use when the user wants to log, review, or resolve technical debt. Also triggers automatically during development when a workaround, shortcut, or deferred implementation is encountered. Activates on phrases like "debito tecnico", "tech debt", "workaround", "soluzione temporanea", "lo facciamo dopo", "rimandiamo", "teniamo traccia", "track this", "defer this", "come back to this".
user-invocable: true
argument-hint: [describe the debt item or leave empty to review existing debt]
---

# Tech Debt Skill

This skill has two modes:

1. **Log mode** — called explicitly by the user or triggered during development when a shortcut/workaround is taken
2. **Review mode** — called explicitly to review and resolve existing open debt items

---

## Mode Detection

- If `$ARGUMENTS` describes a new issue or a workaround is being taken → **Log mode**
- If `$ARGUMENTS` is empty or says "review", "lista", "list", "check" → **Review mode**
- If triggered automatically mid-task (you detect a workaround) → **Log mode**, then ask the user

---

## Log Mode — Recording New Tech Debt

### Step 1 — Understand the issue

Gather the following information (ask the user if not clear from context):

1. **What is the problem or limitation?** (e.g. missing infra, time constraint, missing dependency)
2. **What workaround is in place, if any?** (describe the current stub or shortcut)
3. **What is the impact?** (what breaks, degrades, or is insecure as a result)
4. **What is needed to resolve it?** (infra, library, env vars, refactor)
5. **Priority** — ask the user: Low / Medium / High / Critical
6. **Area** — infer from context (e.g. Infrastructure, Authentication, Database, Frontend, API, Testing)

### Step 2 — Decide: defer or implement now?

**Ask the user explicitly:**

> "Vuoi registrare questo come debito tecnico e rimandarlo, oppure ci sono le condizioni per implementarlo adesso?"

- If the user says **defer** → proceed to Step 3
- If the user says **implement now** → exit this skill and proceed with the implementation inline. Do NOT create a debt file.

### Step 3 — Check for existing debt on the same topic

Read all files in `docs/tech-debt/` and check if a related item already exists. If yes, ask the user whether to update the existing file or create a new one.

### Step 4 — Create the debt file

Create `docs/tech-debt/<slug>.md` using the template below.

**Filename:** kebab-case slug of the problem area (e.g. `smtp-email.md`, `mysql-connection-pool.md`)

Use `.claude/skills/find-tech-debt/TEMPLATE.md` as the template for the generated file.

### Step 5 — Confirm and commit

After writing the file:

1. Show the user the created file path
2. Ask if they want to commit the debt file now or later
3. If yes: stage and commit with message `docs: add tech debt for <title>`

---

## Review Mode — Reviewing Existing Debt

### Step 1 — List all open items

Read all files in `docs/tech-debt/` and build a summary table:

| File | Title | Priority | Status | Area |
| ---- | ----- | -------- | ------ | ---- |
| ...  | ...   | ...      | ...    | ...  |

### Step 2 — Ask what to do

> "Vuoi lavorare su uno di questi item adesso, aggiornarne lo stato, o aggiungerne uno nuovo?"

- **Work on one** → ask which one, then ask: "Ci sono adesso le condizioni per implementarlo?"
  - If yes → implement it inline (follow the task skill workflow if needed), then mark the debt as Resolved
  - If no → show the Resolution Plan and ask if any steps can be done partially
- **Update status** → ask which file and update the `Status` field (Open → In Progress → Resolved)
- **Add new** → switch to Log mode

### Step 3 — Mark as resolved

When a debt item is fully implemented:

1. Update the file's `**Status:**` field to `Resolved`
2. Add a `**Resolved in:**` field with the branch/commit
3. Optionally add a `## Resolution` section describing what was done
4. Commit: `docs: resolve tech debt for <title>`

---

## Automatic Trigger During Development

When working on a task (e.g. via the `/task` skill), if you detect any of the following situations, **pause and ask the user before continuing**:

- A feature is being stubbed out (e.g. `console.log` instead of real logic)
- An environment variable or service is missing and a fallback is being used
- A TODO or FIXME comment is about to be introduced
- A known limitation is being worked around rather than solved
- A library or integration is absent and a placeholder is used

In these cases, say:

> "Sto per introdurre un workaround per [describe issue]. Vuoi che lo registri come debito tecnico, oppure dobbiamo implementarlo subito?"

Then act based on the user's answer.

---

## Critical Rules

- **Never silently introduce technical debt.** Always surface it to the user.
- **Never create a debt file for something that can and should be implemented now.** Debt is a deliberate deferral, not laziness.
- **One file per debt item.** Do not bundle unrelated issues.
- **Keep debt files up to date.** If a resolution is partial, update the Resolution Plan to reflect what was done.
- **Reference debt files in code** with a comment when the workaround lives in a specific function, e.g.:
  ```ts
  // tech-debt: docs/tech-debt/smtp-email.md — using console.log stub, no real SMTP
  ```
