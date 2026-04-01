import { describe, it, expect, vi } from 'vitest';
import { ChatSystem, ChatMessage } from './ChatSystem';

describe('ChatSystem', () => {
  it('should send and store a message', () => {
    const chat = new ChatSystem();
    chat.sendMessage('user1', 'Alice', 'developer', 'Hello');

    const messages = chat.getMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Hello');
    expect(messages[0].senderName).toBe('Alice');
  });

  it('should generate unique message IDs', () => {
    const chat = new ChatSystem();
    chat.sendMessage('u1', 'A', 'dev', 'msg1');
    chat.sendMessage('u2', 'B', 'dev', 'msg2');

    const messages = chat.getMessages();
    expect(messages[0].id).not.toBe(messages[1].id);
  });

  it('should notify listeners on message', () => {
    const chat = new ChatSystem();
    const listener = vi.fn();
    chat.onMessage(listener);

    chat.sendMessage('u1', 'A', 'dev', 'test');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].content).toBe('test');
  });

  it('should unsubscribe via offMessage', () => {
    const chat = new ChatSystem();
    const listener = vi.fn();
    chat.onMessage(listener);
    chat.offMessage(listener);

    chat.sendMessage('u1', 'A', 'dev', 'test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should send system messages', () => {
    const chat = new ChatSystem();
    chat.sendSystemMessage('System alert');

    const messages = chat.getMessages();
    expect(messages[0].type).toBe('system');
    expect(messages[0].senderId).toBe('system');
  });

  it('should send debate messages', () => {
    const chat = new ChatSystem();
    chat.sendDebateMessage('d1', 'Debater', 'analyst', 'Argument');

    const messages = chat.getMessages();
    expect(messages[0].type).toBe('debate');
  });

  it('should limit stored messages to maxMessages', () => {
    const chat = new ChatSystem();
    // Send 110 messages (max is 100)
    for (let i = 0; i < 110; i++) {
      chat.sendMessage('u', 'User', 'dev', `msg-${i}`);
    }
    expect(chat.getMessageCount()).toBe(100);
  });

  it('should return recent messages', () => {
    const chat = new ChatSystem();
    for (let i = 0; i < 10; i++) {
      chat.sendMessage('u', 'User', 'dev', `msg-${i}`);
    }

    const recent = chat.getRecentMessages(3);
    expect(recent.length).toBe(3);
    expect(recent[0].content).toBe('msg-7');
    expect(recent[2].content).toBe('msg-9');
  });

  it('should clear all messages', () => {
    const chat = new ChatSystem();
    chat.sendMessage('u', 'A', 'dev', 'hello');
    chat.clearMessages();
    expect(chat.getMessageCount()).toBe(0);
  });
});
