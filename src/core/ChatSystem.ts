export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'debate';
}

export class ChatSystem {
  private messages: ChatMessage[] = [];
  private maxMessages: number = 100;
  private listeners: ((message: ChatMessage) => void)[] = [];

  sendMessage(senderId: string, senderName: string, senderRole: string, content: string, type: 'text' | 'system' | 'debate' = 'text'): void {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      senderName,
      senderRole,
      content,
      timestamp: Date.now(),
      type,
    };

    this.messages.push(message);

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.notifyListeners(message);
  }

  sendSystemMessage(content: string): void {
    this.sendMessage('system', 'System', 'system', content, 'system');
  }

  sendDebateMessage(senderId: string, senderName: string, senderRole: string, content: string): void {
    this.sendMessage(senderId, senderName, senderRole, content, 'debate');
  }

  onMessage(listener: (message: ChatMessage) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe so callers can clean up. Previously onMessage
    // had no removal path, so any caller registering on each render
    // would leak listeners forever and re-fire each old subscriber.
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private notifyListeners(message: ChatMessage): void {
    // Iterate a snapshot so a listener that unsubscribes (or registers a
    // new listener) during dispatch can't shift the cursor.
    for (const listener of [...this.listeners]) {
      try {
        listener(message);
      } catch (e) {
        // A throwing subscriber used to abort the whole fan-out, so
        // later subscribers silently missed the message. Log and keep
        // going.
        console.error('[ChatSystem] listener threw:', e);
      }
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getRecentMessages(count: number = 20): ChatMessage[] {
    return this.messages.slice(-count);
  }

  clearMessages(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }
}
