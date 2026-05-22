import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Societe } from '../../services/societe.model';
import { SocieteService } from '../../services/societe.service';

@Component({
  selector: 'app-societes-list',
  templateUrl: './societes-list.component.html',
  styleUrls: ['./societes-list.component.css']
})
export class SocietesListComponent implements OnInit {

  societes: Societe[] = [];
  loading = false;
  errorMessage: string | null = null;

  showFormModal = false;
  showDetailModal = false;
  editing: Societe | null = null;
  detailSociete: Societe | null = null;

  form: FormGroup;

  constructor(
    private societeService: SocieteService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      adresse: [''],
      ville: [''],
      pays: [''],
      telephone: [''],
      email: ['', Validators.email],
      password: [''],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.loadSocietes();
  }

  get modalTitle(): string {
    return this.editing ? 'Modifier la société' : 'Ajouter une société';
  }

  loadSocietes(): void {
    this.loading = true;
    this.errorMessage = null;

    this.societeService.getAll().subscribe({
      next: (list) => {
        this.societes = (list ?? []).filter((societe) => societe.id !== 1);
        this.loading = false;
      },
      error: () => {
        this.societes = [];
        this.loading = false;
        this.errorMessage = 'Impossible de charger les sociétés.';
      }
    });
  }

  openCreate(): void {
    this.editing = null;
    this.form.reset({ active: true });
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.form.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  openEdit(item: Societe): void {
    this.editing = item;
    this.form.patchValue({
      nom: item.nom ?? '',
      adresse: item.adresse ?? '',
      ville: item.ville ?? '',
      pays: item.pays ?? '',
      telephone: item.telephone ?? '',
      email: item.email ?? '',
      password: '',
      active: item.active
    });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  openDetails(item: Societe): void {
    this.detailSociete = item;
    this.showDetailModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
    this.editing = null;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailSociete = null;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: Societe = {
      nom: raw.nom.trim(),
      adresse: raw.adresse?.trim() || undefined,
      ville: raw.ville?.trim() || undefined,
      pays: raw.pays?.trim() || undefined,
      telephone: raw.telephone?.trim() || undefined,
      email: raw.email?.trim() || undefined,
      password: raw.password?.trim() || undefined,
      active: !!raw.active,
      dateCreation: new Date().toISOString(),
      dateAffectation: new Date().toISOString()
    };

    if (this.editing?.id) {
      const updatePayload: Societe = { ...this.editing, ...payload };
      if (!raw.password?.trim()) {
        delete updatePayload.password;
      }
      this.societeService.update(this.editing.id, updatePayload).subscribe({
        next: () => {
          this.loadSocietes();
          this.closeFormModal();
        },
        error: () => (this.errorMessage = 'Erreur lors de la modification.')
      });
      return;
    }

    this.societeService.create(payload).subscribe({
      next: () => {
        this.loadSocietes();
        this.closeFormModal();
      },
      error: () => (this.errorMessage = 'Erreur lors de la création.')
    });
  }

  remove(item: Societe): void {
    if (!item.id) {
      return;
    }
    if (!confirm(`Supprimer la société « ${item.nom} » ?`)) {
      return;
    }

    this.societeService.delete(item.id).subscribe({
      next: () => this.loadSocietes(),
      error: () => (this.errorMessage = 'Erreur lors de la suppression.')
    });
  }

  viewUsers(item: Societe): void {
    if (!item.id) return;
    this.router.navigate(['/admin/societes', item.id, 'utilisateurs']);
  }

  viewRapports(item: Societe): void {
    if (!item.id) return;
    this.router.navigate(['/admin/societes', item.id, 'rapports']);
  }

  viewDashboard(item: Societe): void {
    if (!item.id) return;
    this.router.navigate(['/admin/societes', item.id, 'dashboard']);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}
