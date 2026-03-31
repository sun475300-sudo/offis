export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
  timestamp: number;
}

export class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, Toast> = new Map();
  private history: Toast[] = [];
  private maxHistory: number = 50;

  init(): void {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 3000): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const toast: Toast = {
      id,
      type,
      title,
      message,
      duration,
      timestamp: Date.now(),
    };

    this.toasts.set(id, toast);
    this.history.push(toast);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.renderToast(toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(title: string, message: string, duration?: number): string {
    return this.show('success', title, message, duration);
  }

  error(title: string, message: string, duration?: number): string {
    return this.show('error', title, message, duration);
  }

  warning(title: string, message: string, duration?: number): string {
    return this.show('warning', title, message, duration);
  }

  info(title: string, message: string, duration?: number): string {
    return this.show('info', title, message, duration);
  }

  private renderToast(toast: Toast): void {
    if (!this.container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${toast.type}`;
    el.id = toast.id;

    const icons: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const iconDiv = document.createElement('div');
    iconDiv.className = 'toast-icon';
    iconDiv.textContent = icons[toast.type];

    const contentDiv = document.createElement('div');
    contentDiv.className = 'toast-content';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'toast-title';
    titleDiv.textContent = toast.title;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'toast-message';
    msgDiv.textContent = toast.message;
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(msgDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.dismiss(toast.id));

    el.appendChild(iconDiv);
    el.appendChild(contentDiv);
    el.appendChild(closeBtn);

    this.container.appendChild(el);

    // Trigger animation
    requestAnimationFrame(() => {
      el.classList.add('show');
    });
  }

  dismiss(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => {
        el.remove();
      }, 300);
    }
    this.toasts.delete(id);
  }

  clearAll(): void {
    const ids = Array.from(this.toasts.keys());
    for (const id of ids) {
      this.dismiss(id);
    }
  }

  getHistory(): Toast[] {
    return [...this.history];
  }

  getActiveCount(): number {
    return this.toasts.size;
  }
}
