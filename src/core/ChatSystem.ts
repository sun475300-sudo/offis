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
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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

  onMessage(listener: (message: ChatMessage) => void): void {
    this.listeners.push(listener);
  }

  offMessage(listener: (message: ChatMessage) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  private notifyListeners(message: ChatMessage): void {
    for (const listener of this.listeners) {
      listener(message);
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
