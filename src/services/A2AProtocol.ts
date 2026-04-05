export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface AgentCard {
  agentId: string;
  agentName: string;
  description: string;
  version: string;
  provider?: string;
  capabilities: AgentCapability[];
  skills?: string[];
  maxConcurrentTasks?: number;
  authentication?: { type: string };
  url?: string;
}

export interface A2AMessage {
  id: string;
  type: A2AMessageType;
  senderId: string;
  receiverId: string;
  taskId?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;
}

export type A2AMessageType = 
  | 'tasks/cancel'
  | 'tasks/submit'
  | 'tasks/get'
  | 'tasks/subscribe'
  | 'resources/list'
  | 'resources/get'
  | 'agents/push'
  | 'agents/query';

export interface A2ATask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agentId: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export class A2AProtocol {
  private static instance: A2AProtocol;
  private agentCards: Map<string, AgentCard> = new Map();
  private tasks: Map<string, A2ATask> = new Map();
  private messageQueue: A2AMessage[] = [];
  private messageHandlers: Map<A2AMessageType, (msg: A2AMessage) => Promise<unknown>> = new Map();

  private constructor() {}

  static getInstance(): A2AProtocol {
    if (!A2AProtocol.instance) {
      A2AProtocol.instance = new A2AProtocol();
    }
    return A2AProtocol.instance;
  }

  registerAgent(card: AgentCard): void {
    this.agentCards.set(card.agentId, card);
  }

  unregisterAgent(agentId: string): boolean {
    return this.agentCards.delete(agentId);
  }

  getAgentCard(agentId: string): AgentCard | undefined {
    return this.agentCards.get(agentId);
  }

  getAllAgentCards(): AgentCard[] {
    return Array.from(this.agentCards.values());
  }

  discoverAgents(capability?: string): AgentCard[] {
    if (!capability) {
      return this.getAllAgentCards();
    }
    return Array.from(this.agentCards.values()).filter(card =>
      card.capabilities.some(c => c.name.toLowerCase().includes(capability.toLowerCase()))
    );
  }

  async sendMessage(message: Omit<A2AMessage, 'id' | 'timestamp'>): Promise<A2AMessage> {
    const msg: A2AMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    const handler = this.messageHandlers.get(msg.type);
    if (handler) {
      try {
        msg.result = await handler(msg);
      } catch (error) {
        msg.error = error instanceof Error ? error.message : String(error);
      }
    } else {
      this.messageQueue.push(msg);
    }

    return msg;
  }

  registerHandler(type: A2AMessageType, handler: (msg: A2AMessage) => Promise<unknown>): void {
    this.messageHandlers.set(type, handler);
  }

  createTask(agentId: string, input: Record<string, unknown>): A2ATask {
    const task: A2ATask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      agentId,
      input,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(taskId: string): A2ATask | undefined {
    return this.tasks.get(taskId);
  }

  updateTask(taskId: string, updates: Partial<A2ATask>): A2ATask | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, updates, { updatedAt: Date.now() });
    }
    return task;
  }

  getTasksByAgent(agentId: string): A2ATask[] {
    return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
  }

  getQueuedMessages(): A2AMessage[] {
    return [...this.messageQueue];
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
  }
}

export const a2aProtocol = A2AProtocol.getInstance();