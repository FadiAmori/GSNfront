import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { SocieteService } from '../../../admin/services/societe.service';
import { Produit, ProduitService } from '../../../admin/services/produit.service';
import { TypeClient, TypeClientService } from '../../../admin/services/type-client.service';
import { FamilleProduit, FamilleProduitService } from '../../../admin/services/famille-produit.service';

@Component({
  selector: 'app-rapport-produits',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './rapport-produits.component.html',
  styleUrls: ['./rapport-produits.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RapportProduitsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly typeClientService = inject(TypeClientService);
  private readonly familleService = inject(FamilleProduitService);
  private readonly produitService = inject(ProduitService);

  readonly societeId = signal<number | null>(null);
  readonly rapportId = signal<number | null>(null);
  readonly societeName = signal<string>('Société');
  readonly loading = signal(false);

  readonly typeClients = signal<TypeClient[]>([]);
  readonly familles = signal<FamilleProduit[]>([]);
  readonly produits = signal<Produit[]>([]);
  readonly editingProduit = signal<Produit | null>(null);

  readonly backLink = computed(() => ['/admin/societes', String(this.societeId() ?? ''), 'rapports']);
  readonly crLink = computed(() => ['/admin/societes', this.societeId() ?? '', 'rapports', this.rapportId() ?? '', 'rapport-cr']);
  readonly isSociete = computed(() => sessionStorage.getItem('userType') === 'societe');

  readonly typeMap = computed(() => {
    const map = new Map<number, TypeClient>();
    this.typeClients().forEach(item => {
      if (item.id != null) map.set(item.id, item);
    });
    return map;
  });

  readonly familleMap = computed(() => {
    const map = new Map<number, FamilleProduit>();
    this.familles().forEach(item => {
      if (item.id != null) map.set(item.id, item);
    });
    return map;
  });

  readonly typeClientForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    description: this.fb.control('')
  });

  readonly familleForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    description: this.fb.control('')
  });

  readonly produitForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    code: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    poidsPrevu: this.fb.control(0, { nonNullable: true, validators: [Validators.required] }),
    tauxPoids: this.fb.control(0, { nonNullable: true }),
    tpsUnitaire: this.fb.control(0, { nonNullable: true }),
    tempsGlobal: this.fb.control(0, { nonNullable: true }),
    coutMODParHeure: this.fb.control(0, { nonNullable: true }),
    typeClientId: this.fb.control<number | null>(null, { validators: [Validators.required] }),
    familleProduitId: this.fb.control<number | null>(null, { validators: [Validators.required] })
  });

  ngOnInit(): void {
    const currentSocieteId = Number(this.route.snapshot.paramMap.get('id'));
    const currentRapportId = Number(this.route.snapshot.paramMap.get('rapportId'));

    if (!currentSocieteId || Number.isNaN(currentSocieteId) || !currentRapportId || Number.isNaN(currentRapportId)) {
      this.router.navigate(['/societe/dashboard']);
      return;
    }

    this.societeId.set(currentSocieteId);
    this.rapportId.set(currentRapportId);
    this.loadSociete(currentSocieteId);
    this.loadData();
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s: any) => this.societeName.set(s?.nom ?? 'Société'),
      error: () => this.societeName.set('Société')
    });
  }

  private loadData(): void {
    this.loading.set(true);

    forkJoin([
      this.typeClientService.getAll(),
      this.familleService.getAll(),
      this.produitService.getAll()
    ]).subscribe({
      next: ([types, familles, produits]) => {
        this.typeClients.set(types ?? []);
        this.familles.set(familles ?? []);
        this.produits.set(produits ?? []);
      },
      error: () => {
        this.typeClients.set([]);
        this.familles.set([]);
        this.produits.set([]);
      },
      complete: () => this.loading.set(false)
    });
  }

  addTypeClient(): void {
    if (this.isSociete()) return;
    if (this.typeClientForm.invalid) {
      this.typeClientForm.markAllAsTouched();
      return;
    }

    const raw = this.typeClientForm.getRawValue();
    this.typeClientService.create({ nom: raw.nom, description: raw.description }).subscribe({
      next: () => this.loadData(),
      complete: () => this.typeClientForm.reset({ nom: '', description: '' })
    });
  }

  addFamille(): void {
    if (this.isSociete()) return;
    if (this.familleForm.invalid) {
      this.familleForm.markAllAsTouched();
      return;
    }

    const raw = this.familleForm.getRawValue();
    this.familleService.create({ nom: raw.nom, description: raw.description }).subscribe({
      next: () => this.loadData(),
      complete: () => this.familleForm.reset({ nom: '', description: '' })
    });
  }

  saveProduit(): void {
    if (this.isSociete()) return;
    if (this.produitForm.invalid) {
      this.produitForm.markAllAsTouched();
      return;
    }

    const raw = this.produitForm.getRawValue();
    const payload: Produit = {
      nom: raw.nom,
      code: raw.code,
      poidsPrevu: Number(raw.poidsPrevu ?? 0),
      tauxPoids: Number(raw.tauxPoids ?? 0),
      tpsUnitaire: Number(raw.tpsUnitaire ?? 0),
      tempsGlobal: Number(raw.tempsGlobal ?? 0),
      coutMODParHeure: Number(raw.coutMODParHeure ?? 0),
      typeClientId: raw.typeClientId ?? undefined,
      familleProduitId: raw.familleProduitId ?? undefined
    };

    const editing = this.editingProduit();
    const request$: Observable<unknown> = editing?.id
      ? this.produitService.update(editing.id, { ...editing, ...payload })
      : this.produitService.create(payload);

    request$.subscribe({
      next: () => this.loadData(),
      complete: () => this.resetProduitForm()
    });
  }

  openEditProduit(prod: Produit): void {
    if (this.isSociete()) return;
    this.editingProduit.set(prod);
    this.produitForm.reset({
      nom: prod.nom ?? '',
      code: prod.code ?? '',
      poidsPrevu: prod.poidsPrevu ?? 0,
      tauxPoids: prod.tauxPoids ?? 0,
      tpsUnitaire: prod.tpsUnitaire ?? 0,
      tempsGlobal: prod.tempsGlobal ?? 0,
      coutMODParHeure: prod.coutMODParHeure ?? 0,
      typeClientId: prod.typeClientId ?? null,
      familleProduitId: prod.familleProduitId ?? null
    });
  }

  cancelProduitEdit(): void {
    this.resetProduitForm();
  }

  private resetProduitForm(): void {
    this.editingProduit.set(null);
    this.produitForm.reset({
      nom: '',
      code: '',
      poidsPrevu: 0,
      tauxPoids: 0,
      tpsUnitaire: 0,
      tempsGlobal: 0,
      coutMODParHeure: 0,
      typeClientId: null,
      familleProduitId: null
    });
  }

  typeClientName(id?: number | null): string {
    if (id == null) return '—';
    return this.typeMap().get(id)?.nom ?? '—';
  }

  familleName(id?: number | null): string {
    if (id == null) return '—';
    return this.familleMap().get(id)?.nom ?? '—';
  }

  trackById(_index: number, item: { id?: number | null }): number | null {
    return item.id ?? null;
  }
}
