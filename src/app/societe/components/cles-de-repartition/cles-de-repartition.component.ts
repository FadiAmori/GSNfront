import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ClesDeRepartition, ClesDeRepartitionService } from '../../../admin/services/cles-de-repartition.service';
import { SocieteService } from '../../../admin/services/societe.service';

@Component({
  selector: 'app-cles-de-repartition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './cles-de-repartition.component.html',
  styleUrls: ['./cles-de-repartition.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClesDeRepartitionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ClesDeRepartitionService);
  private readonly societeService = inject(SocieteService);

  readonly societeId = signal<number | null>(null);
  readonly societeName = signal<string>('Societe');
  readonly cles = signal<ClesDeRepartition[]>([]);
  readonly loading = signal(false);
  readonly showModal = signal(false);
  readonly editing = signal<ClesDeRepartition | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly months = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
  ];

  readonly form = this.fb.group({
    mois: this.fb.control<string | null>(null, { validators: [Validators.required] }),
    saisonaliteCA: this.fb.control(0, { nonNullable: true, validators: [Validators.required] }),
    saisonalitePoids: this.fb.control(0, { nonNullable: true, validators: [Validators.required] }),
    clesCoutFixes: this.fb.control(0, { nonNullable: true, validators: [Validators.required] })
  });

  readonly modalTitle = computed(() => (this.editing() ? 'Modifier une cle' : 'Ajouter une cle'));
  readonly backLink = computed(() => ['/admin/societes', String(this.societeId() ?? ''), 'rapports']);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : Number(sessionStorage.getItem('societeId'));

    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/societe/dashboard']);
      return;
    }

    this.societeId.set(id);
    this.loadSociete(id);
    this.loadCles(id);
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s: any) => this.societeName.set(s?.nom ?? 'Societe'),
      error: () => this.societeName.set('Societe')
    });
  }

  private loadCles(id: number): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.service.getAll().subscribe({
      next: (data) => {
        const filtered = (data ?? []).filter(c => c.societeId === id || c.idSociete === id);
        this.cles.set(filtered);
      },
      error: () => {
        this.cles.set([]);
        this.errorMessage.set('Impossible de charger les cles.');
      },
      complete: () => this.loading.set(false)
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      mois: null,
      saisonaliteCA: 0,
      saisonalitePoids: 0,
      clesCoutFixes: 0
    });
    this.showModal.set(true);
  }

  openEdit(item: ClesDeRepartition): void {
    this.editing.set(item);
    this.form.reset({
      mois: item.mois ?? null,
      saisonaliteCA: item.saisonaliteCA ?? 0,
      saisonalitePoids: item.saisonalitePoids ?? 0,
      clesCoutFixes: item.clesCoutFixes ?? 0
    });
    this.showModal.set(true);
  }

  close(): void {
    this.showModal.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const currentSocieteId = this.societeId();
    if (!currentSocieteId) return;

    const raw = this.form.getRawValue();
    const payload: ClesDeRepartition = {
      societeId: currentSocieteId,
      idSociete: currentSocieteId,
      mois: raw.mois,
      saisonaliteCA: Number(raw.saisonaliteCA ?? 0),
      saisonalitePoids: Number(raw.saisonalitePoids ?? 0),
      clesCoutFixes: Number(raw.clesCoutFixes ?? 0)
    };

    const currentEditing = this.editing();
    const request$: Observable<unknown> = currentEditing?.id
      ? this.service.update(currentEditing.id, { ...currentEditing, ...payload })
      : this.service.create(payload);

    request$.subscribe({
      next: () => this.loadCles(currentSocieteId),
      complete: () => this.close()
    });
  }

  remove(item: ClesDeRepartition): void {
    if (!item.id) return;
    const currentSocieteId = this.societeId();

    this.service.delete(item.id).subscribe({
      next: () => {
        if (currentSocieteId) this.loadCles(currentSocieteId);
      }
    });
  }

  trackByCle(_index: number, item: ClesDeRepartition): number | undefined {
    return item.id;
  }
}
