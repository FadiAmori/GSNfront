import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SocieteService } from '../../services/societe.service';
import { RapportFinancierService } from '../../services/rapport-financier.service';
import { TypeRapport } from '../../services/rapport-financier.model';
import { CategorieCR, CategorieCrService } from '../../services/categorie-cr.service';
import { SousCategorieCR, SousCategorieCrService } from '../../services/sous-categorie-cr.service';
import { LigneFinanciere } from '../../services/ligne-financiere.model';
import { LigneFinanciereService } from '../../services/ligne-financiere.service';
import { CategorieFinanciere } from '../../services/categorie-financiere.model';
import { CategorieFinanciereService } from '../../services/categorie-financiere.service';
import { SousCategorieFinanciere } from '../../services/sous-categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../services/sous-categorie-financiere.service';
import { Produit, ProduitService } from '../../services/produit.service';
import { TypeClient, TypeClientService } from '../../services/type-client.service';
import { FamilleProduit, FamilleProduitService } from '../../services/famille-produit.service';

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
  private readonly rapportService = inject(RapportFinancierService);
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
  readonly cloneCrModalOpen = signal(false);
  readonly cloneCrLoading = signal(false);
  readonly cloneCrSources = signal<{ id: number; label: string }[]>([]);
  readonly selectedCloneCrSourceId = signal<number | null>(null);

  readonly typeLabels: Record<TypeRapport, string> = {
    0: 'REEL',
    1: 'PREVISIONNEL',
    2: 'CR'
  };

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
    const currentSocieteId = Number(this.route.snapshot.paramMap.get('id'));
    const currentRapportId = Number(this.route.snapshot.paramMap.get('rapportId'));

    if (!currentSocieteId || Number.isNaN(currentSocieteId) || !currentRapportId || Number.isNaN(currentRapportId)) {
      this.router.navigate(['/admin/societes']);
      return;
    }

    this.societeId.set(currentSocieteId);
    this.rapportId.set(currentRapportId);
    this.loadSociete(currentSocieteId);
    this.loadData(currentRapportId);
    this.loadCloneCrSources(currentSocieteId, currentRapportId);
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

  private normalizeLabel(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private loadCloneCrSources(societeId: number, currentRapportId: number): void {
    this.cloneCrLoading.set(true);
    this.rapportService.getAll().subscribe({
      next: (all) => {
        const options = (all ?? [])
          .filter(r => r.societeId === 1 && r.id && r.id !== currentRapportId)
          .map(r => ({
            id: r.id as number,
            label: `${this.typeLabels[r.type as TypeRapport]} · ${r.annee}`
          }));
        this.cloneCrSources.set(options);
        this.cloneCrLoading.set(false);
      },
      error: () => {
        this.cloneCrSources.set([]);
        this.cloneCrLoading.set(false);
      }
    });
  }

  openCloneCrModal(): void {
    if (this.isSociete()) return;
    const societeId = this.societeId();
    const rapportId = this.rapportId();
    if (!this.cloneCrSources().length && societeId && rapportId) {
      this.loadCloneCrSources(societeId, rapportId);
    }
    this.cloneCrModalOpen.set(true);
  }

  cancelCloneCr(): void {
    this.cloneCrModalOpen.set(false);
    this.selectedCloneCrSourceId.set(null);
  }

  onSelectCloneCrSource(id: number | null): void {
    this.selectedCloneCrSourceId.set(id);
  }

  confirmCloneCr(): void {
    const targetId = this.rapportId();
    const sourceId = this.selectedCloneCrSourceId();
    if (!targetId || !sourceId) return;

    this.loading.set(true);

    forkJoin({
      catsCr: this.categorieCrService.getAll(),
      sousCr: this.sousCategorieCrService.getAll(),
      lignes: this.ligneService.getAll(),
      catsFin: this.categorieService.getAll(),
      sousFin: this.sousCategorieService.getAll()
    }).subscribe({
      next: ({ catsCr, sousCr, lignes, catsFin, sousFin }) => {
        const sourceCats = (catsCr ?? []).filter(c => c.rapportFinancierId === sourceId);
        if (!sourceCats.length) {
          this.finishCloneCr(targetId);
          return;
        }

        forkJoin(sourceCats.map(cat => this.categorieCrService.create({
          nom: cat.nom ?? '',
          rapportFinancierId: targetId
        }))).subscribe({
          next: (newCats) => {
            const catIdMap = new Map<number, number>();
            sourceCats.forEach((cat, index) => {
              if (cat.id != null && newCats[index]?.id != null) {
                catIdMap.set(cat.id, newCats[index].id as number);
              }
            });

            const sourceSous = (sousCr ?? [])
              .filter(sc => catIdMap.has(sc.categorieCrId));

            forkJoin(sourceSous.map(sc => this.sousCategorieCrService.create({
              nom: sc.nom ?? '',
              categorieCrId: catIdMap.get(sc.categorieCrId) as number
            }))).subscribe({
              next: (newSous) => {
                const sousIdMap = new Map<number, number>();
                sourceSous.forEach((sc, index) => {
                  if (sc.id != null && newSous[index]?.id != null) {
                    sousIdMap.set(sc.id, newSous[index].id as number);
                  }
                });

                const sousFinById = new Map<number, SousCategorieFinanciere>();
                (sousFin ?? []).forEach(sc => {
                  if (sc.id != null) sousFinById.set(sc.id, sc);
                });

                const catsFinById = new Map<number, CategorieFinanciere>();
                (catsFin ?? []).forEach(cat => {
                  if (cat.id != null) catsFinById.set(cat.id, cat);
                });

                const lineReportId = (line: LigneFinanciere): number | null => {
                  const sousF = sousFinById.get(line.sousCategorieFinanciereId);
                  if (!sousF) return null;
                  const catF = catsFinById.get(sousF.categorieFinanciereId);
                  return catF?.rapportFinancierId ?? null;
                };

                const sourceLines = (lignes ?? []).filter(line => lineReportId(line) === sourceId);
                const targetLines = (lignes ?? []).filter(line => lineReportId(line) === targetId);

                const targetIndex = new Map<string, LigneFinanciere>();
                for (const line of targetLines) {
                  const sousF = sousFinById.get(line.sousCategorieFinanciereId);
                  const catF = sousF ? catsFinById.get(sousF.categorieFinanciereId) : undefined;
                  const key = [
                    this.normalizeLabel(catF?.nom),
                    this.normalizeLabel(sousF?.nom),
                    this.normalizeLabel(line.nom)
                  ].join('||');
                  targetIndex.set(key, line);
                }

                const updates = sourceLines
                  .map(line => {
                    const crLine = line as LigneFinanciereCr;
                    if (crLine.id == null || !crLine.sousCategorieCrId) return null;

                    const newSousId = sousIdMap.get(crLine.sousCategorieCrId);
                    if (!newSousId) return null;

                    const sousF = sousFinById.get(crLine.sousCategorieFinanciereId);
                    const catF = sousF ? catsFinById.get(sousF.categorieFinanciereId) : undefined;
                    const key = [
                      this.normalizeLabel(catF?.nom),
                      this.normalizeLabel(sousF?.nom),
                      this.normalizeLabel(crLine.nom)
                    ].join('||');

                    const targetLine = targetIndex.get(key);
                    if (!targetLine?.id) return null;

                    return this.ligneService.update(targetLine.id, {
                      ...targetLine,
                      sousCategorieCrId: newSousId
                    } as LigneFinanciere);
                  })
                  .filter((item): item is ReturnType<typeof this.ligneService.update> => item != null);

                if (!updates.length) {
                  this.finishCloneCr(targetId);
                  return;
                }

                forkJoin(updates).subscribe({
                  next: () => this.finishCloneCr(targetId),
                  error: () => this.finishCloneCr(targetId)
                });
              },
              error: () => this.finishCloneCr(targetId)
            });
          },
          error: () => this.finishCloneCr(targetId)
        });
      },
      error: () => this.finishCloneCr(targetId)
    });
  }

  private finishCloneCr(rapportId: number): void {
    this.loadData(rapportId);
    this.loading.set(false);
    this.cloneCrModalOpen.set(false);
    this.selectedCloneCrSourceId.set(null);
  }
}
