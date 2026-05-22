import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface LineChartSeries {
  label: string;
  data: number[];
  color?: string;
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styleUrls: ['./line-chart.component.css']
})
export class LineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() labels: string[] = [];
  @Input() series: LineChartSeries[] = [];

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private renderChart(): void {
    if (!this.canvasRef) {
      return;
    }

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (!this.labels.length || !this.series.length) {
      return;
    }

    const datasets = this.series.slice(0, 2).map((item) => ({
      label: item.label,
      data: item.data,
      fill: false,
      borderColor: item.color || 'rgba(33, 115, 70, 1)',
      backgroundColor: item.color || 'rgba(33, 115, 70, 0.3)',
      tension: 0.2,
      pointRadius: 3,
      pointHoverRadius: 4
    }));

    const config: ChartConfiguration = {
      type: 'line' as ChartType,
      data: {
        labels: this.labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            }
          },
          y: {
            display: true,
            title: {
              display: false
            },
            beginAtZero: true
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }
}
