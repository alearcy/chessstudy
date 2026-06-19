/**
 * Plan Mode Extension — Modalità Piano
 *
 * Modalità esplorativa in sola lettura per analisi sicura del codice.
 * Quando attiva, sono disponibili solo strumenti read-only.
 *
 * Comandi:
 * - /piano o Ctrl+Alt+P per attivare/disattivare
 * - /attivita per mostrare i progressi
 *
 * Funzionamento:
 * 1. Attiva la modalità piano con /piano
 * 2. Chiedi all'agente di analizzare il codice e creare un piano
 * 3. L'agente produce un piano numerato sotto l'intestazione "Piano:"
 * 4. Scegli "Esegui il piano" per passare all'esecuzione
 * 5. Durante l'esecuzione, l'agente marca i passi con [FATTO:n]
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { extractTodoItems, isSafeCommand, markCompletedSteps, type TodoItem } from "./utils.ts";

// Strumenti disponibili nelle due modalità
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];

// Type guard per messaggi assistant
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === "assistant" && Array.isArray(m.content);
}

// Estrae il contenuto testuale di un messaggio assistant
function getTextContent(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;
  let executionMode = false;
  let todoItems: TodoItem[] = [];

  pi.registerFlag("piano", {
    description: "Avvia in modalità piano (esplorazione in sola lettura)",
    type: "boolean",
    default: false,
  });

  function updateStatus(ctx: ExtensionContext): void {
    // Stato nel footer
    if (executionMode && todoItems.length > 0) {
      const completed = todoItems.filter((t) => t.completed).length;
      ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${completed}/${todoItems.length}`));
    } else if (planModeEnabled) {
      ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ piano"));
    } else {
      ctx.ui.setStatus("plan-mode", undefined);
    }

    // Widget con la lista delle attività
    if (executionMode && todoItems.length > 0) {
      const lines = todoItems.map((item) => {
        if (item.completed) {
          return (
            ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(item.text))
          );
        }
        return `${ctx.ui.theme.fg("muted", "☐ ")}${item.text}`;
      });
      ctx.ui.setWidget("plan-todos", lines);
    } else {
      ctx.ui.setWidget("plan-todos", undefined);
    }
  }

  function togglePlanMode(ctx: ExtensionContext): void {
    planModeEnabled = !planModeEnabled;
    executionMode = false;
    todoItems = [];

    if (planModeEnabled) {
      pi.setActiveTools(PLAN_MODE_TOOLS);
      ctx.ui.notify(`Modalità piano attiva. Strumenti: ${PLAN_MODE_TOOLS.join(", ")}`);
    } else {
      pi.setActiveTools(NORMAL_MODE_TOOLS);
      ctx.ui.notify("Modalità piano disattivata. Accesso completo ripristinato.");
    }
    updateStatus(ctx);
  }

  function persistState(): void {
    pi.appendEntry("plan-mode", {
      enabled: planModeEnabled,
      todos: todoItems,
      executing: executionMode,
    });
  }

  pi.registerCommand("piano", {
    description: "Attiva/disattiva la modalità piano (sola lettura)",
    handler: async (_args, ctx) => togglePlanMode(ctx),
  });

  pi.registerCommand("attivita", {
    description: "Mostra la lista delle attività del piano corrente",
    handler: async (_args, ctx) => {
      if (todoItems.length === 0) {
        ctx.ui.notify("Nessuna attività. Crea prima un piano con /piano", "info");
        return;
      }
      const list = todoItems.map((item, i) => `${i + 1}. ${item.completed ? "✓" : "○"} ${item.text}`).join("\n");
      ctx.ui.notify(`Progresso Piano:\n${list}`, "info");
    },
  });

  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Attiva/disattiva modalità piano",
    handler: async (ctx) => togglePlanMode(ctx),
  });

  // Blocca comandi bash distruttivi in modalità piano
  pi.on("tool_call", async (event) => {
    if (!planModeEnabled || event.toolName !== "bash") return;

    const command = event.input.command as string;
    if (!isSafeCommand(command)) {
      return {
        block: true,
        reason: `Modalità piano: comando bloccato (non nella allowlist). Usa /piano per disattivare la modalità.\nComando: ${command}`,
      };
    }
  });

  // Filtra contesto obsoleto della modalità piano quando non è attiva
  pi.on("context", async (event) => {
    if (planModeEnabled) return;

    return {
      messages: event.messages.filter((m) => {
        const msg = m as AgentMessage & { customType?: string };
        if (msg.customType === "plan-mode-context") return false;
        if (msg.role !== "user") return true;

        const content = msg.content;
        if (typeof content === "string") {
          return !content.includes("[MODALITÀ PIANO ATTIVA]");
        }
        if (Array.isArray(content)) {
          return !content.some(
            (c) => c.type === "text" && (c as TextContent).text?.includes("[MODALITÀ PIANO ATTIVA]"),
          );
        }
        return true;
      }),
    };
  });

  // Inietta contesto piano/esecuzione prima che l'agente parta
  pi.on("before_agent_start", async () => {
    if (planModeEnabled) {
      return {
        message: {
          customType: "plan-mode-context",
          content: `[MODALITÀ PIANO ATTIVA]
Sei in modalità piano — una modalità esplorativa in sola lettura per analisi sicura del codice.

Restrizioni:
- Puoi usare solo: read, bash, grep, find, ls, questionnaire
- NON puoi usare: edit, write (le modifiche ai file sono disabilitate)
- Bash è limitato a una allowlist di comandi in sola lettura

Usa il tool questionnaire per fare domande di chiarimento.
Usa la skill brave-search via bash per ricerche web.

Crea un piano numerato dettagliato sotto un'intestazione "Piano:":

Piano:
1. Descrizione del primo passo
2. Descrizione del secondo passo
...

NON tentare di fare modifiche — descrivi solo cosa faresti.`,
          display: false,
        },
      };
    }

    if (executionMode && todoItems.length > 0) {
      const remaining = todoItems.filter((t) => !t.completed);
      const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
      return {
        message: {
          customType: "plan-execution-context",
          content: `[ESECUZIONE PIANO — Accesso completo agli strumenti]

Passi rimanenti:
${todoList}

Esegui ogni passo in ordine.
Dopo aver completato un passo, includi un tag [FATTO:n] nella tua risposta.`,
          display: false,
        },
      };
    }
  });

  // Traccia i progressi dopo ogni turno
  pi.on("turn_end", async (event, ctx) => {
    if (!executionMode || todoItems.length === 0) return;
    if (!isAssistantMessage(event.message)) return;

    const text = getTextContent(event.message);
    if (markCompletedSteps(text, todoItems) > 0) {
      updateStatus(ctx);
    }
    persistState();
  });

  // Gestisce il completamento del piano e l'UI della modalità piano
  pi.on("agent_end", async (event, ctx) => {
    // Verifica se l'esecuzione è completata
    if (executionMode && todoItems.length > 0) {
      if (todoItems.every((t) => t.completed)) {
        const completedList = todoItems.map((t) => `~~${t.text}~~`).join("\n");
        pi.sendMessage(
          { customType: "plan-complete", content: `**Piano Completato!** ✓\n\n${completedList}`, display: true },
          { triggerTurn: false },
        );
        executionMode = false;
        todoItems = [];
        pi.setActiveTools(NORMAL_MODE_TOOLS);
        updateStatus(ctx);
        persistState();
      }
      return;
    }

    if (!planModeEnabled || !ctx.hasUI) return;

    // Estrae i todo dall'ultimo messaggio assistant
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (lastAssistant) {
      const extracted = extractTodoItems(getTextContent(lastAssistant));
      if (extracted.length > 0) {
        todoItems = extracted;
      }
    }

    // Mostra i passi del piano e chiede la prossima azione
    if (todoItems.length > 0) {
      const todoListText = todoItems.map((t, i) => `${i + 1}. ☐ ${t.text}`).join("\n");
      pi.sendMessage(
        {
          customType: "plan-todo-list",
          content: `**Passi del Piano (${todoItems.length}):**\n\n${todoListText}`,
          display: true,
        },
        { triggerTurn: false },
      );
    }

    const choice = await ctx.ui.select("Modalità piano — cosa fare?", [
      todoItems.length > 0 ? "Esegui il piano (traccia progressi)" : "Esegui il piano",
      "Rimani in modalità piano",
      "Raffina il piano",
    ]);

    if (choice?.startsWith("Esegui")) {
      planModeEnabled = false;
      executionMode = todoItems.length > 0;
      pi.setActiveTools(NORMAL_MODE_TOOLS);
      updateStatus(ctx);

      const execMessage =
        todoItems.length > 0
          ? `Esegui il piano. Inizia con: ${todoItems[0].text}`
          : "Esegui il piano che hai appena creato.";
      pi.sendMessage(
        { customType: "plan-mode-execute", content: execMessage, display: true },
        { triggerTurn: true },
      );
    } else if (choice === "Raffina il piano") {
      const refinement = await ctx.ui.editor("Raffina il piano:", "");
      if (refinement?.trim()) {
        pi.sendUserMessage(refinement.trim());
      }
    }
  });

  // Ripristina lo stato all'avvio/ripristino della sessione
  pi.on("session_start", async (_event, ctx) => {
    if (pi.getFlag("piano") === true) {
      planModeEnabled = true;
    }

    const entries = ctx.sessionManager.getEntries();

    // Ripristina stato persistito
    const planModeEntry = entries
      .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "plan-mode")
      .pop() as { data?: { enabled: boolean; todos?: TodoItem[]; executing?: boolean } } | undefined;

    if (planModeEntry?.data) {
      planModeEnabled = planModeEntry.data.enabled ?? planModeEnabled;
      todoItems = planModeEntry.data.todos ?? todoItems;
      executionMode = planModeEntry.data.executing ?? executionMode;
    }

    // Al resume: ri-scansiona i messaggi per ricostruire lo stato di completamento
    const isResume = planModeEntry !== undefined;
    if (isResume && executionMode && todoItems.length > 0) {
      let executeIndex = -1;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i] as { type: string; customType?: string };
        if (entry.customType === "plan-mode-execute") {
          executeIndex = i;
          break;
        }
      }

      const messages: AssistantMessage[] = [];
      for (let i = executeIndex + 1; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.type === "message" && "message" in entry && isAssistantMessage(entry.message as AgentMessage)) {
          messages.push(entry.message as AssistantMessage);
        }
      }
      const allText = messages.map(getTextContent).join("\n");
      markCompletedSteps(allText, todoItems);
    }

    if (planModeEnabled) {
      pi.setActiveTools(PLAN_MODE_TOOLS);
    }
    updateStatus(ctx);
  });
}
