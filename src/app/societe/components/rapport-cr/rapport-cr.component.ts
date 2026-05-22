import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SocieteService } from '../../../admin/services/societe.service';
import { CategorieCR, CategorieCrService } from '../../../admin/services/categorie-cr.service';
import { SousCategorieCR, SousCategorieCrService } from '../../../admin/services/sous-categorie-cr.service';
import { LigneFinanciere } from '../../../admin/services/ligne-financiere.model';
import { LigneFinanciereService } from '../../../admin/services/ligne-financiere.service';
import { CategorieFinanciere } from '../../../admin/services/categorie-financiere.model';
import { CategorieFinanciereService } from '../../../admin/services/categorie-financiere.service';
import { SousCategorieFinanciere } from '../../../admin/services/sous-categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../../admin/services/sous-categorie-financiere.service';
import { Produit, ProduitService } from '../../../admin/services/produit.service';
import { TypeClient, TypeClientService } from '../../../admin/services/type-client.service';
import { FamilleProduit, FamilleProduitService } from '../../../admin/services/famille-produit.service';

type LigneFinanciereCr = LigneFinanciere & { sousCategorieCrId?: number | null };

@Component({
  selector: 'app-rapport-cr',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule],
  templateUrl: './rapport-cr.component.html',
  styleUrls: ['./rapport-cr.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RapportCrComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly categorieCrService = inject(CategorieCrService);
  private readonly sousCategorieCrService = inject(SousCategorieCrService);
  private readonly ligneService = inject(LigneFinanciereService);
  private readonly categorieService = inject(CategorieFinanciereService);
  private readonly sousCategorieService = inject(SousCategorieFinanciereService);
  private readonly produitService = inject(ProduitService);
  private readonly typeClientService = inject(TypeClientService);
  private readonly familleService = inject(FamilleProduitService);

  readonly societeId = signal<number | null>(null);
  readonly rapportId = signal<number | null>(null);
  readonly societeName = signal<string>('Société');
  readonly loading = signal(false);

  readonly categories = signal<CategorieCR[]>([]);
  readonly sousCategories = signal<SousCategorieCR[]>([]);
  readonly lignes = signal<LigneFinanciereCr[]>([]);
  readonly financialCategories = signal<CategorieFinanciere[]>([]);
  readonly financialSousCategories = signal<SousCategorieFinanciere[]>([]);
  readonly produits = signal<Produit[]>([]);
  readonly typeClients = signal<TypeClient[]>([]);
  readonly familles = signal<FamilleProduit[]>([]);

  readonly categorieForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] })
  });

  readonly sousCategorieForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    categorieCrId: this.fb.control<number | null>(null, { validators: [Validators.required] })
  });

  readonly backLink = computed(() => ['/admin/societes', String(this.societeId() ?? ''), 'rapports']);
  readonly produitsLink = computed(() => ['/admin/societes', this.societeId() ?? '', 'rapports', this.rapportId() ?? '', 'rapport-produits']);
  readonly isSociete = computed(() => sessionStorage.getItem('userType') === 'societe');

  readonly sousByCategory = computed(() => {
    const map = new Map<number, SousCategorieCR[]>();
    this.sousCategories().forEach(sc => {
      const list = map.get(sc.categorieCrId) ?? [];
      list.push(sc);
      map.set(sc.categorieCrId, list);
    });
    return map;
  });

  readonly lignesBySousCategorie = computed(() => {
    const map = new Map<number, LigneFinanciereCr[]>();
    this.lignes().forEach(l => {
      const key = l.sousCategorieCrId ?? -1;
      const list = map.get(key) ?? [];
      list.push(l);
      map.set(key, list);
    });
    return map;
  });

  readonly flatColumns = computed(() => {
    const cols: { sousId: number; line?: LigneFinanciereCr }[] = [];
    this.categories().forEach(cat => {
      const sousList = this.sousByCategory().get(cat.id ?? -1) ?? [];
      if (sousList.length === 0) {
        cols.push({ sousId: -(cat.id ?? cols.length + 1) });
      } else {
        sousList.forEach(sous => {
          const lines = this.lignesBySousCategorie().get(sous.id ?? -1) ?? [];
          if (lines.length === 0) {
            cols.push({ sousId: sous.id ?? -1 });
          } else {
            lines.forEach(line => cols.push({ sousId: sous.id ?? -1, line }));
          }
        });
      }
    });
    return cols;
  });

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

  ngOnInit(): void {
    const currentSocieteId = Number(
      this.route.snapshot.paramMap.get('id') ?? sessionStorage.getItem('societeId')
    );
    const currentRapportId = Number(this.route.snapshot.paramMap.get('rapportId'));

    if (!currentSocieteId || Number.isNaN(currentSocieteId) || !currentRapportId || Number.isNaN(currentRapportId)) {
      this.router.navigate(['/societe/dashboard']);
      return;
    }

    this.societeId.set(currentSocieteId);
    this.rapportId.set(currentRapportId);
    this.loadSociete(currentSocieteId);
    this.loadData(currentRapportId);
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s: any) => this.societeName.set(s?.nom ?? 'Société'),
      error: () => this.societeName.set('Société')
    });
  }

  private loadData(rapportId: number): void {
    this.loading.set(true);

    forkJoin([
      this.categorieCrService.getAll(),
      this.sousCategorieCrService.getAll(),
      this.ligneService.getAll(),
      this.categorieService.getAll(),
      this.sousCategorieService.getAll(),
      this.produitService.getAll(),
      this.typeClientService.getAll(),
      this.familleService.getAll()
    ]).subscribe({
      next: ([categories, sous, lignes, catsFin, sousFin, produits, typeClients, familles]) => {
        this.financialCategories.set(catsFin ?? []);
        this.financialSousCategories.set(sousFin ?? []);
        this.produits.set(produits ?? []);
        this.typeClients.set(typeClients ?? []);
        this.familles.set(familles ?? []);

        const filteredCats = (categories ?? []).filter(c => c.rapportFinancierId === rapportId);
        this.categories.set(filteredCats);

        const allowedCatIds = new Set(filteredCats.map(c => c.id).filter(Boolean) as number[]);
        const filteredSous = (sous ?? []).filter(sc => allowedCatIds.has(sc.categorieCrId));
        this.sousCategories.set(filteredSous);

        const sousFinById = new Map<number, SousCategorieFinanciere>();
        (sousFin ?? []).forEach(sc => { if (sc.id != null) sousFinById.set(sc.id, sc); });

        const catsFinById = new Map<number, CategorieFinanciere>();
        (catsFin ?? []).forEach(c => { if (c.id != null) catsFinById.set(c.id, c); });

        const rapportForLigne = (line: LigneFinanciere): number | null => {
          const sousF = sousFinById.get(line.sousCategorieFinanciereId);
          if (!sousF) return null;
          const catF = catsFinById.get(sousF.categorieFinanciereId);
          return catF?.rapportFinancierId ?? null;
        };

        const lignesForReport = (lignes ?? []).filter(line => rapportForLigne(line as LigneFinanciere) === rapportId);
        this.lignes.set(lignesForReport as LigneFinanciereCr[]);
      },
      error: () => {
        this.categories.set([]);
        this.sousCategories.set([]);
        this.lignes.set([]);
      },
      complete: () => this.loading.set(false)
    });
  }

  addCategorie(): void {
    if (this.isSociete()) return;
    if (this.categorieForm.invalid) {
      this.categorieForm.markAllAsTouched();
      return;
    }

    const currentRapportId = this.rapportId();
    if (!currentRapportId) return;

    const payload: CategorieCR = {
      nom: this.categorieForm.value.nom ?? '',
      rapportFinancierId: currentRapportId
    };

    this.categorieCrService.create(payload).subscribe({
      next: () => this.loadData(currentRapportId),
      complete: () => this.categorieForm.reset({ nom: '' })
    });
  }

  addSousCategorie(): void {
    if (this.isSociete()) return;
    if (this.sousCategorieForm.invalid) {
      this.sousCategorieForm.markAllAsTouched();
      return;
    }

    const raw = this.sousCategorieForm.getRawValue();
    const currentRapportId = this.rapportId();
    if (!raw.categorieCrId || !currentRapportId) return;

    this.sousCategorieCrService.create({ nom: raw.nom ?? '', categorieCrId: raw.categorieCrId }).subscribe({
      next: () => this.loadData(currentRapportId),
      complete: () => this.sousCategorieForm.reset({ nom: '', categorieCrId: null })
    });
  }

  updateLigneSousCategorie(ligne: LigneFinanciereCr, sousCategorieCrId: number | null): void {
    if (this.isSociete()) return;
    if (!ligne.id) return;

    const currentRapportId = this.rapportId();
    const payload = { ...ligne, sousCategorieCrId } as LigneFinanciere;

    this.ligneService.update(ligne.id, payload).subscribe({
      next: () => {
        if (currentRapportId) this.loadData(currentRapportId);
      }
    });
  }

  categoryColspan(catId: number | undefined | null): number {
    if (!catId) return 1;
    const sousList = this.sousByCategory().get(catId) ?? [];
    if (sousList.length === 0) return 1;

    const total = sousList.reduce((sum, sous) => {
      const count = this.lignesBySousCategorie().get(sous.id ?? -1)?.length ?? 0;
      return sum + (count > 0 ? count : 1);
    }, 0);

    return total > 0 ? total : 1;
  }

  sousColspan(sousId: number | undefined | null): number {
    const count = this.lignesBySousCategorie().get(sousId ?? -1)?.length ?? 0;
    return count > 0 ? count : 1;
  }

  cellValueFor(prod: Produit, line?: LigneFinanciereCr): number {
    if (!line) return 0;
    const percent = Number(prod.tauxPoids ?? 0);
    const amount = Number(line.montant ?? 0);
    return amount * (percent / 100);
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

  trackByColumn(index: number, item: { sousId: number; line?: LigneFinanciereCr }): string | number {
    return item.line?.id ?? `sous-${item.sousId}-${index}`;
  }
}
