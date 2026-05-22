import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SocieteService } from '../../services/societe.service';
import { RapportFinancierService } from '../../services/rapport-financier.service';
import { Societe } from '../../services/societe.model';
import { RapportFinancier } from '../../services/rapport-financier.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  societes: Societe[] = [];
  rapports: RapportFinancier[] = [];

  nbSocietes = 0;
  nbRapportsSoc1 = 0;
  nbActives = 0;
  nbInactives = 0;
  nbAnnees = 0;

  recentRows: any[] = [];

  private charts: Chart[] = [];

  constructor(
    private societeService: SocieteService,
    private rapportService: RapportFinancierService
  ) {}

  ngOnInit(): void {
    forkJoin({
      societes: this.societeService.getAll(),
      rapports: this.rapportService.getAll()
    }).subscribe(({ societes, rapports }) => {
      this.societes = societes;
      this.rapports = rapports;
      this.computeStats();
      this.buildRecentRows();
      setTimeout(() => this.buildCharts(), 0);
    });
  }

  private computeStats(): void {
    this.nbSocietes = this.societes.length;
    this.nbRapportsSoc1 = this.rapports.filter(r => r.societeId === 1).length;
    this.nbActives = this.societes.filter(s => s.active).length;
    this.nbInactives = this.societes.length - this.nbActives;
    const years = [...new Set(this.rapports.map(r => r.annee))];
    this.nbAnnees = years.length;
  }

private buildRecentRows(): void {
  this.recentRows = [...this.societes]
    .slice(-5)
    .reverse()
    .map(s => {
      return {
        societe: s.nom,
        annee: s.dateCreation ? new Date(s.dateCreation).getFullYear() : '—',
        statut: s.active ? 'Active' : 'Inactive',
        statutClass: s.active ? 'ok' : 'draft'
      };
    });
}
  private buildCharts(): void {
    this.buildDoughnut();
    this.buildBarStatut();
    this.buildLineAnnees();
  }

  private buildDoughnut(): void {
    const rptBySoc: Record<number, number> = {};
this.societes.forEach(s => {
  if (s.id !== undefined) {
    rptBySoc[s.id] = 0;
  }
});    this.rapports.forEach(r => { if (rptBySoc[r.societeId] !== undefined) rptBySoc[r.societeId]++; });

    const labels = this.societes.map(s => s.nom);
const data = this.societes.map(s =>
  s.id !== undefined ? rptBySoc[s.id] : 0
);    const colors = ['#69f0ae','#00e676','#76ff03','#b9f6ca','#00bcd4','#1de9b6'];

    const ctx = document.getElementById('doughnutChart') as HTMLCanvasElement;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#0d2414', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }
    }));
  }

  private buildBarStatut(): void {
    const ctx = document.getElementById('squareChart') as HTMLCanvasElement;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Actives', 'Inactives'],
        datasets: [{ data: [this.nbActives, this.nbInactives], backgroundColor: ['#69f0ae','#37474f'], borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    }));
  }

  private buildLineAnnees(): void {
    const yearMap: Record<number, number> = {};
    this.rapports.forEach(r => { yearMap[r.annee] = (yearMap[r.annee] || 0) + 1; });
    const sortedYears = Object.keys(yearMap).map(Number).sort();

    const ctx = document.getElementById('lineChart') as HTMLCanvasElement;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedYears,
        datasets: [{
          label: 'Rapports', data: sortedYears.map(y => yearMap[y]),
          borderColor: '#69f0ae', backgroundColor: 'rgba(105,240,174,0.12)',
          borderWidth: 2, fill: true, tension: 0.35, pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    }));
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
  }
}