export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  pinned: boolean;
  source?: string;
  action?: NotificationAction;
  metadata?: Record<string, unknown>;
}

export interface NotificationAction {
  label: string;
  callback: () => void;
}

export interface NotificationFilter {
  type?: NotificationType[];
  read?: boolean;
  since?: number;
  source?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  pinned: number;
  byType: Record<NotificationType, number>;
}

export class NotificationCenter {
  private static instance: NotificationCenter;
  private notifications: Map<string, Notification> = new Map();
  private maxNotifications = 500;
  private listeners: Set<(notification: Notification) => void> = new Set();

  private constructor() {}

  static getInstance(): NotificationCenter {
    if (!NotificationCenter.instance) {
      NotificationCenter.instance = new NotificationCenter();
    }
    return NotificationCenter.instance;
  }

  add(type: NotificationType, title: string, message: string, options?: Partial<Notification>): string {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      pinned: false,
      ...options
    };

    if (this.notifications.size >= this.maxNotifications) {
      this.evictOldest();
    }

    this.notifications.set(id, notification);
    this.notifyListeners(notification);
    return id;
  }

  info(title: string, message: string, options?: Partial<Notification>): string {
    return this.add('info', title, message, options);
  }

  success(title: string, message: string, options?: Partial<Notification>): string {
    return this.add('success', title, message, options);
  }

  warning(title: string, message: string, options?: Partial<Notification>): string {
    return this.add('warning', title, message, options);
  }

  error(title: string, message: string, options?: Partial<Notification>): string {
    return this.add('error', title, message, options);
  }

  system(title: string, message: string, options?: Partial<Notification>): string {
    return this.add('system', title, message, options);
  }

  get(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  getAll(filter?: NotificationFilter): Notification[] {
    let result = Array.from(this.notifications.values());

    if (filter) {
      if (filter.type) {
        result = result.filter(n => filter.type!.includes(n.type));
      }
      if (filter.read !== undefined) {
        result = result.filter(n => n.read === filter.read);
      }
      if (filter.since) {
        result = result.filter(n => n.timestamp >= filter.since!);
      }
      if (filter.source) {
        result = result.filter(n => n.source === filter.source);
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  markAsRead(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }

  markAllAsRead(): number {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }
    return count;
  }

  pin(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.pinned = true;
      return true;
    }
    return false;
  }

  unpin(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.pinned = false;
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    return this.notifications.delete(id);
  }

  clear(): void {
    for (const notification of this.notifications.values()) {
      if (!notification.pinned) {
        this.notifications.delete(notification.id);
      }
    }
  }

  subscribe(listener: (notification: Notification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(notification: Notification): void {
    for (const listener of this.listeners) {
      listener(notification);
    }
  }

  private evictOldest(): void {
    let oldest: Notification | null = null;
    for (const notification of this.notifications.values()) {
      if (!notification.pinned && (!oldest || notification.timestamp < oldest.timestamp)) {
        oldest = notification;
      }
    }
    if (oldest) {
      this.notifications.delete(oldest.id);
    }
  }

  getStats(): NotificationStats {
    const stats: NotificationStats = {
      total: this.notifications.size,
      unread: 0,
      pinned: 0,
      byType: { info: 0, success: 0, warning: 0, error: 0, system: 0 }
    };

    for (const notification of this.notifications.values()) {
      stats.byType[notification.type]++;
      if (!notification.read) stats.unread++;
      if (notification.pinned) stats.pinned++;
    }

    return stats;
  }
}

export const notificationCenter = NotificationCenter.getInstance();