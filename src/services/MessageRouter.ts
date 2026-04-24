export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
export type RoutingStrategy = 'direct' | 'broadcast' | 'multicast' | 'scatter_gather';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface RoutableMessage {
  id: string;
  type: string;
  senderId: string;
  receiverIds: string[];
  payload: unknown;
  priority: MessagePriority;
  timestamp: number;
  ttl: number;
  correlationId?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingRule {
  id: string;
  name: string;
  sourceFilter?: string;
  typeFilter?: string;
  destinationStrategy: RoutingStrategy;
  destinations?: string[];
  transform?: (msg: RoutableMessage) => RoutableMessage;
  enabled: boolean;
}

export interface DeliveryRecord {
  messageId: string;
  receiverId: string;
  status: DeliveryStatus;
  attempts: number;
  lastAttempt: number;
  error?: string;
}

export class MessageRouter {
  private static instance: MessageRouter;
  private rules: Map<string, RoutingRule> = new Map();
  private messageBuffer: RoutableMessage[] = [];
  private deliveryRecords: Map<string, DeliveryRecord[]> = new Map();
  private handlers: Map<string, (msg: RoutableMessage) => void | Promise<void>> = new Map();
  private defaultTTL = 300000;
  private maxBufferSize = 1000;

  private constructor() {
    this.registerDefaultRules();
  }

  static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter();
    }
    return MessageRouter.instance;
  }

  private registerDefaultRules(): void {
    this.addRule({
      name: 'Default Direct',
      destinationStrategy: 'direct',
      enabled: true
    });

    this.addRule({
      name: 'System Broadcast',
      typeFilter: 'system',
      destinationStrategy: 'broadcast',
      enabled: true
    });
  }

  addRule(rule: Omit<RoutingRule, 'id'>): RoutingRule {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newRule: RoutingRule = { ...rule, id };
    this.rules.set(id, newRule);
    return newRule;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  route(message: RoutableMessage): string[] {
    const routes: string[] = [];
    const matchingRules = Array.from(this.rules.values())
      .filter(r => r.enabled && this.ruleMatches(r, message));

    for (const rule of matchingRules) {
      let destinations: string[] = [];

      switch (rule.destinationStrategy) {
        case 'direct':
          destinations = message.receiverIds;
          break;
        case 'broadcast':
          destinations = message.receiverIds;
          break;
        case 'multicast':
          destinations = rule.destinations || [];
          break;
        case 'scatter_gather':
          destinations = message.receiverIds;
          break;
      }

      if (rule.transform) {
        const transformed = rule.transform(message);
        routes.push(...transformed.receiverIds);
      } else {
        routes.push(...destinations);
      }
    }

    return [...new Set(routes)];
  }

  private ruleMatches(rule: RoutingRule, message: RoutableMessage): boolean {
    if (rule.sourceFilter && !message.senderId.includes(rule.sourceFilter)) {
      return false;
    }
    if (rule.typeFilter && message.type !== rule.typeFilter) {
      return false;
    }
    return true;
  }

  send(message: Omit<RoutableMessage, 'id' | 'timestamp'>): string {
    const msg: RoutableMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    if (msg.ttl === undefined) {
      msg.ttl = this.defaultTTL;
    }

    if (this.messageBuffer.length >= this.maxBufferSize) {
      const evicted = this.messageBuffer.shift();
      // deliveryRecords was keyed by message.id with no cleanup hook; it
      // grew in lockstep with every send() forever. When a message is
      // evicted from the buffer, also drop its delivery records.
      if (evicted) this.deliveryRecords.delete(evicted.id);
    }
    this.messageBuffer.push(msg);

    const routes = this.route(msg);
    for (const receiverId of routes) {
      void this.deliver(msg, receiverId);
    }

    return msg.id;
  }

  private async deliver(message: RoutableMessage, receiverId: string): Promise<void> {
    const key = `${message.id}-${receiverId}`;
    const record: DeliveryRecord = {
      messageId: message.id,
      receiverId,
      status: 'pending',
      attempts: 0,
      lastAttempt: Date.now()
    };

    if (!this.deliveryRecords.has(message.id)) {
      this.deliveryRecords.set(message.id, []);
    }
    this.deliveryRecords.get(message.id)!.push(record);

    const handler = this.handlers.get(receiverId);
    if (handler) {
      record.attempts++;
      try {
        await handler(message);
        record.status = 'delivered';
      } catch (error) {
        record.status = 'failed';
        record.error = error instanceof Error ? error.message : String(error);
      }
    } else {
      record.status = 'sent';
    }
  }

  registerHandler(receiverId: string, handler: (msg: RoutableMessage) => void | Promise<void>): void {
    this.handlers.set(receiverId, handler);
  }

  unregisterHandler(receiverId: string): boolean {
    return this.handlers.delete(receiverId);
  }

  getMessageHistory(limit = 100): RoutableMessage[] {
    return this.messageBuffer.slice(-limit);
  }

  getDeliveryStatus(messageId: string): DeliveryRecord[] {
    return this.deliveryRecords.get(messageId) || [];
  }

  retryFailed(): number {
    let retried = 0;
    for (const records of this.deliveryRecords.values()) {
      for (const record of records) {
        if (record.status === 'failed') {
          record.status = 'pending';
          record.attempts++;
          retried++;
        }
      }
    }
    return retried;
  }

  clearBuffer(): void {
    this.messageBuffer = [];
  }

  getBufferSize(): number {
    return this.messageBuffer.length;
  }
}

export const messageRouter = MessageRouter.getInstance();