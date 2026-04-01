export interface ChartData {
  label: string;
  value: number;
  color: string;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Validate CSS color values to prevent CSS/SVG injection */
function sanitizeColor(color: string): string {
  // Allow hex, rgb(), rgba(), hsl(), hsla(), and named CSS colors
  if (/^(#[0-9a-fA-F]{3,8}|rgb(a?)\([^)]+\)|hsl(a?)\([^)]+\)|var\(--[a-zA-Z0-9-]+\)|[a-zA-Z]{1,20})$/.test(color)) {
    return color;
  }
  return '#888888'; // fallback for invalid colors
}

export class ChartRenderer {
  private container: HTMLElement | null = null;
  private charts: Map<string, HTMLElement> = new Map();

  init(): void {
    this.container = document.getElementById('charts-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'charts-container';
      this.container.className = 'charts-container';
      
      const gameContainer = document.querySelector('.game-container');
      if (gameContainer) {
        gameContainer.appendChild(this.container);
      }
    }
  }

  createBarChart(id: string, title: string, data: ChartData[]): void {
    const chart = document.createElement('div');
    chart.className = 'chart chart-bar';
    chart.id = `chart-${id}`;

    const maxValue = Math.max(...data.map(d => d.value), 1);

    let barsHtml = '';
    for (const item of data) {
      const height = (item.value / maxValue) * 100;
      barsHtml += `
        <div class="bar-item">
          <div class="bar" style="height: ${height}%; background: ${sanitizeColor(item.color)}">
            <span class="bar-value">${escapeHtml(String(item.value))}</span>
          </div>
          <div class="bar-label">${escapeHtml(item.label)}</div>
        </div>
      `;
    }

    chart.innerHTML = `
      <div class="chart-header">
        <span class="chart-title">${escapeHtml(title)}</span>
        <button class="chart-close">×</button>
      </div>
      <div class="chart-body">
        ${barsHtml}
      </div>
    `;

    const closeBtn = chart.querySelector('.chart-close')!;
    closeBtn.addEventListener('click', () => {
      chart.remove();
      this.charts.delete(id);
    });

    this.container?.appendChild(chart);
    this.charts.set(id, chart);
  }

  createLineChart(id: string, title: string, data: TimeSeriesData[]): void {
    const chart = document.createElement('div');
    chart.className = 'chart chart-line';
    chart.id = `chart-${id}`;

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const minValue = Math.min(...data.map(d => d.value), 0);
    const range = maxValue - minValue || 1;

    let points = '';
    let path = '';
    const width = 280;
    const height = 100;

    for (let i = 0; i < data.length; i++) {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - ((data[i].value - minValue) / range) * height;
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
      points += `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent-cyan)"/>`;
    }

    chart.innerHTML = `
      <div class="chart-header">
        <span class="chart-title">${escapeHtml(title)}</span>
        <button class="chart-close">×</button>
      </div>
      <div class="chart-body">
        <svg width="${width}" height="${height}" class="line-chart-svg">
          <path d="${path}" fill="none" stroke="var(--accent-cyan)" stroke-width="2"/>
          ${points}
        </svg>
        <div class="chart-labels">
          <span>${data.length > 0 ? escapeHtml(new Date(data[0].timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })) : ''}</span>
          <span>${data.length > 0 ? escapeHtml(new Date(data[data.length - 1].timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })) : ''}</span>
        </div>
      </div>
    `;

    const closeBtn = chart.querySelector('.chart-close')!;
    closeBtn.addEventListener('click', () => {
      chart.remove();
      this.charts.delete(id);
    });

    this.container?.appendChild(chart);
    this.charts.set(id, chart);
  }

  createPieChart(id: string, title: string, data: ChartData[]): void {
    const chart = document.createElement('div');
    chart.className = 'chart chart-pie';
    chart.id = `chart-${id}`;

    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    let currentAngle = 0;
    let paths = '';

    for (const item of data) {
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
      const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
      const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
      const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);

      const largeArc = angle > 180 ? 1 : 0;

      paths += `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${sanitizeColor(item.color)}"/>`;
      currentAngle = endAngle;
    }

    let legendHtml = '';
    for (const item of data) {
      const percent = Math.round((item.value / total) * 100);
      legendHtml += `
        <div class="pie-legend-item">
          <span class="pie-legend-color" style="background: ${sanitizeColor(item.color)}"></span>
          <span class="pie-legend-label">${escapeHtml(item.label)}</span>
          <span class="pie-legend-value">${percent}%</span>
        </div>
      `;
    }

    chart.innerHTML = `
      <div class="chart-header">
        <span class="chart-title">${escapeHtml(title)}</span>
        <button class="chart-close">×</button>
      </div>
      <div class="chart-body pie-body">
        <svg width="100" height="100" class="pie-chart-svg">
          ${paths}
        </svg>
        <div class="pie-legend">
          ${legendHtml}
        </div>
      </div>
    `;

    const closeBtn = chart.querySelector('.chart-close')!;
    closeBtn.addEventListener('click', () => {
      chart.remove();
      this.charts.delete(id);
    });

    this.container?.appendChild(chart);
    this.charts.set(id, chart);
  }

  updateChart(id: string, data: ChartData[]): void {
    const chart = this.charts.get(id);
    if (!chart) return;

    const bars = chart.querySelectorAll('.bar-item');
    const maxValue = Math.max(...data.map(d => d.value), 1);

    for (let i = 0; i < Math.min(bars.length, data.length); i++) {
      const bar = bars[i].querySelector('.bar') as HTMLElement;
      const valueSpan = bars[i].querySelector('.bar-value') as HTMLElement;
      if (bar && valueSpan) {
        const height = (data[i].value / maxValue) * 100;
        bar.style.height = `${height}%`;
        valueSpan.textContent = String(data[i].value);
      }
    }
  }

  removeChart(id: string): void {
    const chart = this.charts.get(id);
    if (chart) {
      chart.remove();
      this.charts.delete(id);
    }
  }

  clearAll(): void {
    const keys = [...this.charts.keys()];
    for (const id of keys) {
      this.removeChart(id);
    }
  }

  getChartCount(): number {
    return this.charts.size;
  }
}
