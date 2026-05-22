import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RapportFinancierService } from '../../../admin/services/rapport-financier.service';
import { RapportFinancier, TypeRapport } from '../../../admin/services/rapport-financier.model';

@Component({
  selector: 'app-rapport-tableau-selector',
  templateUrl: './rapport-tableau-selector.component.html',
  styleUrls: ['./rapport-tableau-selector.component.css']
})
export class RapportTableauSelectorComponent implements OnInit {
  rapports: RapportFinancier[] = [];
  selectedRapportId: number | null = null;
  errorMessage: string | null = null;
  loading = false;

  constructor(
    private readonly router: Router,
    private readonly rapportService: RapportFinancierService
  ) {}

  ngOnInit(): void {
    const societeId = Number(sessionStorage.getItem('societeId'));
    if (!societeId || Number.isNaN(societeId)) {
      this.router.navigate(['/societe/login']);
      return;
    }

    this.loading = true;
    this.rapportService.getBySocieteId(societeId).subscribe({
      next: (list) => {
        this.rapports = list ?? [];
        const currentYear = new Date().getFullYear();
        const preferred = this.rapports.find(r => r.type === 1 && r.annee === currentYear);
        this.selectedRapportId = preferred?.id ?? this.rapports[0]?.id ?? null;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les rapports.';
        this.loading = false;
      }
    });
  }

  getTypeLabel(type: TypeRapport): string {
    if (type === 0) return 'REEL';
    if (type === 1) return 'PREVISIONNEL';
    return 'CR';
  }

  openTableau(): void {
    if (!this.selectedRapportId) return;
    this.router.navigate(['/societe/rapport-tableau', this.selectedRapportId]);
  }
}
