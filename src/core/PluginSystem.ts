export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  dependencies?: string[];
  hooks?: PluginHooks;
}

export interface PluginHooks {
  onInit?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
  onAgentUpdate?: (agentId: string, data: unknown) => void | Promise<void>;
  onTaskComplete?: (taskId: string, result: unknown) => void | Promise<void>;
  onRender?: (ctx: CanvasRenderingContext2D) => void | Promise<void>;
  onMessage?: (message: unknown) => void | Promise<unknown>;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  loadedAt: number;
}

export class PluginSystem {
  private static instance: PluginSystem;
  private plugins: Map<string, Plugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private hookCallbacks: Map<string, Set<(data: unknown) => void | Promise<void>>> = new Map();

  private constructor() {}

  static getInstance(): PluginSystem {
    if (!PluginSystem.instance) {
      PluginSystem.instance = new PluginSystem();
    }
    return PluginSystem.instance;
  }

  register(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.id)) {
      return false;
    }
    this.plugins.set(plugin.id, plugin);
    this.initializeHookTypes(plugin);
    if (plugin.enabled) {
      this.enablePlugin(plugin.id);
    }
    return true;
  }

  private initializeHookTypes(plugin: Plugin): void {
    if (plugin.hooks) {
      Object.keys(plugin.hooks).forEach(hook => {
        if (!this.hookCallbacks.has(hook)) {
          this.hookCallbacks.set(hook, new Set());
        }
      });
    }
  }

  unregister(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    this.disablePlugin(pluginId);
    return this.plugins.delete(pluginId);
  }

  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.enabledPlugins.has(depId)) {
          this.enablePlugin(depId);
        }
      }
    }
    plugin.enabled = true;
    this.enabledPlugins.add(pluginId);
    plugin.hooks?.onEnable?.();
    return true;
  }

  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = false;
    this.enabledPlugins.delete(pluginId);
    plugin.hooks?.onDisable?.();
    return true;
  }

  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  registerHookCallback(hook: string, callback: (data: unknown) => void | Promise<void>): void {
    if (!this.hookCallbacks.has(hook)) {
      this.hookCallbacks.set(hook, new Set());
    }
    this.hookCallbacks.get(hook)!.add(callback);
  }

  unregisterHookCallback(hook: string, callback: (data: unknown) => void | Promise<void>): void {
    this.hookCallbacks.get(hook)?.delete(callback);
  }

  async triggerHook(hook: string, data?: unknown): Promise<void> {
    const callbacks = this.hookCallbacks.get(hook);
    if (callbacks) {
      for (const cb of callbacks) {
        await cb(data);
      }
    }
  }

  destroy(): void {
    for (const plugin of this.plugins.values()) {
      plugin.hooks?.onDestroy?.();
    }
    this.plugins.clear();
    this.enabledPlugins.clear();
    this.hookCallbacks.clear();
  }
}

export const pluginSystem = PluginSystem.getInstance();