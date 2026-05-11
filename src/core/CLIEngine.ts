/**
 * CLI Engine — enhanced command processor with history, autocomplete, and structured commands.
 * Phase 6: Natural language + structured command processing.
 */
export interface CLICommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<string | void>;
}

export class CLIEngine {
  private commands: Map<string, CLICommand> = new Map();
  private history: string[] = [];
  private historyIndex: number = -1;
  private readonly maxHistory = 100;

  registerCommand(cmd: CLICommand): void {
    // Warn loudly if a command name or alias would silently replace an
    // existing registration. Previously duplicate aliases (e.g. 'h'
    // used by both /help and /harness) were overwritten with no signal
    // and the first command lost its alias.
    if (this.commands.has(cmd.name) && this.commands.get(cmd.name)?.name !== cmd.name) {
      console.warn(`[CLIEngine] Command /${cmd.name} overrides existing command /${this.commands.get(cmd.name)?.name}`);
    }
    this.commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      const existing = this.commands.get(alias);
      if (existing && existing.name !== cmd.name) {
        console.warn(`[CLIEngine] Alias /${alias} for /${cmd.name} overrides existing /${existing.name}`);
      }
      this.commands.set(alias, cmd);
    }
  }

  /** Parse and execute a command string */
  async execute(input: string): Promise<{ output: string; type: 'success' | 'error' | 'info' }> {
    const trimmed = input.trim();
    if (!trimmed) return { output: '', type: 'info' };

    this.pushHistory(trimmed);

    // Check for slash commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);

      const cmd = this.commands.get(cmdName);
      if (cmd) {
        try {
          const result = await cmd.handler(args);
          return { output: result || `Command /${cmdName} executed.`, type: 'success' };
        } catch (err) {
          return { output: `Error: ${err}`, type: 'error' };
        }
      }
      return { output: `Unknown command: /${cmdName}. Type /help for available commands.`, type: 'error' };
    }

    // Natural language — pass through to orchestrator
    return { output: trimmed, type: 'info' };
  }

  /** Get autocomplete suggestions for partial input */
  getAutocompleteSuggestions(partial: string): string[] {
    if (!partial.startsWith('/')) return [];

    const prefix = partial.slice(1).toLowerCase();
    const suggestions: string[] = [];
    const seen = new Set<string>();

    for (const [name, cmd] of this.commands) {
      if (name.startsWith(prefix) && !seen.has(cmd.name)) {
        suggestions.push(`/${cmd.name}`);
        seen.add(cmd.name);
      }
    }

    return suggestions.sort();
  }

  /** Navigate command history */
  historyUp(): string | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.history.length - 1 - this.historyIndex];
    }
    return null;
  }

  historyDown(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.history[this.history.length - 1 - this.historyIndex];
    }
    this.historyIndex = -1;
    return '';
  }

  getRegisteredCommands(): CLICommand[] {
    const seen = new Set<string>();
    const commands: CLICommand[] = [];
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        commands.push(cmd);
        seen.add(cmd.name);
      }
    }
    return commands;
  }

  private pushHistory(input: string): void {
    if (this.history.length > 0 && this.history[this.history.length - 1] === input) return;
    this.history.push(input);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = -1;
  }
}
