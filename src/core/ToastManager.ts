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
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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

    el.innerHTML = `
      <div class="toast-icon">${icons[toast.type]}</div>
      <div class="toast-content">
        <div class="toast-title">${toast.title}</div>
        <div class="toast-message">${toast.message}</div>
      </div>
      <button class="toast-close" onclick="window.__toastManager?.dismiss('${toast.id}')">×</button>
    `;

    this.container.appendChild(el);

    // Expose dismiss method globally for onclick
    (window as any).__toastManager = this;

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
    for (const [id] of this.toasts) {
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
