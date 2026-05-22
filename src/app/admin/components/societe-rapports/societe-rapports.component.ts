import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SocieteService } from '../../services/societe.service';
import { RapportFinancier, TypeRapport } from '../../services/rapport-financier.model';
import { RapportFinancierService } from '../../services/rapport-financier.service';
import { CrService } from '../../services/cr.service';
import { CR } from '../../services/cr.model';

@Component({
  selector: 'app-societe-rapports',
  templateUrl: './societe-rapports.component.html',
  styleUrls: ['./societe-rapports.component.css']
})
export class SocieteRapportsComponent implements OnInit {

  societeId: number | null = null;
  societeName = 'Société';
  rapports: RapportFinancier[] = [];
  loading = false;
  errorMessage: string | null = null;

  showFormModal = false;
  editing: RapportFinancier | null = null;
  form: FormGroup;

  types = [
    { value: 0 as TypeRapport, label: 'Réel' },
    { value: 1 as TypeRapport, label: 'Prévisionnel' },
    { value: 2 as TypeRapport, label: 'CR' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private rapportService: RapportFinancierService,
    private societeService: SocieteService,
    private crService: CrService
  ) {
    this.form = this.fb.group({
      type: [0 as TypeRapport],
      annee: [new Date().getFullYear(), [Validators.required, Validators.min(1900)]]
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/admin/societes']);
      return;
    }
    this.societeId = id;
    this.loadSociete(id);
    this.loadRapports(id);
  }

  get modalTitle(): string {
    return this.editing ? 'Modifier le rapport' : 'Ajouter un rapport';
  }

  getTypeLabel(type: TypeRapport): string {
    const found = this.types.find((t) => t.value === type);
    return found?.label ?? '—';
  }

  loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s) => (this.societeName = s.nom ?? 'Société'),
      error: () => (this.societeName = 'Société')
    });
  }

  loadRapports(societeId: number): void {
    this.loading = true;
    this.errorMessage = null;

    this.rapportService.getAll().subscribe({
      next: (list) => {
        this.rapports = (list ?? []).filter((r) => r.societeId === societeId);
        this.loading = false;
      },
      error: () => {
        this.rapports = [];
        this.loading = false;
        this.errorMessage = 'Impossible de charger les rapports.';
      }
    });
  }

  openCreate(): void {
    this.editing = null;
    this.form.reset({ type: 0, annee: new Date().getFullYear() });
    this.showFormModal = true;
  }

  openEdit(rapport: RapportFinancier): void {
    this.editing = rapport;
    this.form.reset({
      type: rapport.type ?? 0,
      annee: rapport.annee
    });
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
    this.editing = null;
  }

  save(): void {
    if (this.form.invalid || !this.societeId) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: RapportFinancier = {
      societeId: this.societeId,
      type: raw.type as TypeRapport,
      annee: Number(raw.annee)
    };

    if (this.editing?.id) {
      this.rapportService.update(this.editing.id, { ...this.editing, ...payload }).subscribe({
        next: () => {
          this.loadRapports(this.societeId!);
          this.closeFormModal();
        },
        error: () => (this.errorMessage = 'Erreur lors de la modification.')
      });
      return;
    }

    this.rapportService.create(payload).subscribe({
      next: (created) => {
        this.createCrIfNeeded(created);
        this.loadRapports(this.societeId!);
        this.closeFormModal();
      },
      error: () => (this.errorMessage = 'Erreur lors de la création.')
    });
  }

  private createCrIfNeeded(rapport: RapportFinancier): void {
    if (!rapport.id || rapport.type === 2) {
      return;
    }

    this.crService.getAll().subscribe({
      next: (crs) => {
        const exists = (crs ?? []).some((c: CR) => c.rapportFinancierId === rapport.id);
        if (!exists) {
          this.crService.create({
            montantConsomme: 0,
            annee: rapport.annee,
            rapportFinancierId: rapport.id!
          }).subscribe();
        }
      }
    });
  }

  remove(rapport: RapportFinancier): void {
    if (!rapport.id || !this.societeId) {
      return;
    }
    if (!confirm(`Supprimer le rapport ${this.getTypeLabel(rapport.type)} ${rapport.annee} ?`)) {
      return;
    }

    this.rapportService.delete(rapport.id).subscribe({
      next: () => this.loadRapports(this.societeId!),
      error: () => (this.errorMessage = 'Erreur lors de la suppression.')
    });
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}
