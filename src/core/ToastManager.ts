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

  showTestNotification(type: 'success' | 'error' | 'warning' | 'info', testType: string, result: any): string {
    let title = '';
    let message = '';
    
    switch (testType) {
      case 'stress':
        title = '부하 테스트 완료';
        message = `작업: ${result.totalTasksCompleted}, 실패: ${result.failedTasks}, 시간: ${result.duration.toFixed(1)}s`;
        break;
      case 'load':
        title = '부하 생성 테스트 완료';
        message = `에이전트: ${result.activeAgents}, 생성시간: ${result.spawnTime}ms, FPS드롭: ${result.fpsDrop.toFixed(1)}`;
        break;
      case 'debate':
        title = '토론 테스트 완료';
        message = `턴: ${result.turns}, 에러: ${result.errors}`;
        break;
      case 'cicd':
        title = 'CI/CD 테스트 완료';
        message = `성공: ${result.success}, 실패: ${result.failed}, 성공률: ${(result.success / (result.success + result.failed) * 100).toFixed(1)}%`;
        break;
      case 'meeting':
        title = '회의 협업 테스트 완료';
        message = `메시지: ${result.messages}, 충돌: ${result.conflicts}`;
        break;
      default:
        title = '테스트 완료';
        message = JSON.stringify(result).slice(0, 50);
    }
    
    return this.show(type, title, message, 5000);
  }

  notifyTestAlert(alerts: string[]): void {
    alerts.forEach(alert => {
      this.show('warning', '테스트 알림', alert, 8000);
    });
  }
}
