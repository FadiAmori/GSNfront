import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { DragDropModule, moveItemInArray, CdkDragDrop } from '@angular/cdk/drag-drop';
import { RapportFinancierService } from '../../../admin/services/rapport-financier.service';
import { TypeRapport } from '../../../admin/services/rapport-financier.model';
import { SocieteService } from '../../../admin/services/societe.service';
import { CategorieFinanciere } from '../../../admin/services/categorie-financiere.model';
import { CategorieFinanciereService } from '../../../admin/services/categorie-financiere.service';
import { SousCategorieFinanciere } from '../../../admin/services/sous-categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../../admin/services/sous-categorie-financiere.service';
import { LigneFinanciere } from '../../../admin/services/ligne-financiere.model';
import { LigneFinanciereService } from '../../../admin/services/ligne-financiere.service';
import * as XLSX from 'xlsx';
import { LigneCalculee } from '../../../admin/services/ligne-calculee.model';
import { LigneCalculeeService, UpdateLigneCalculeeDto } from '../../../admin/services/ligne-calculee.service';
import { ExcelLigneCalculee } from '../../../admin/services/excel-ligne-calculee.model';
import { ExcelLigneCalculeeService } from '../../../admin/services/excel-ligne-calculee.service';

export type MixedItem =
  | { type: 'categorie'; data: CategorieFinanciere; index: number }
  | { type: 'calculee';  data: LigneCalculee;       index: number };

@Component({
  selector: 'app-rapport-tableau',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, DragDropModule],
  templateUrl: './rapport-tableau.component.html',
  styleUrls: ['./rapport-tableau.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RapportTableauComponent implements OnInit {
  private readonly defaultColor = '#3b82f6';
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly rapportService = inject(RapportFinancierService);
  private readonly societeService = inject(SocieteService);
  private readonly categorieService = inject(CategorieFinanciereService);
  private readonly sousCategorieService = inject(SousCategorieFinanciereService);
  private readonly ligneService = inject(LigneFinanciereService);
  private readonly ligneCalculeeService = inject(LigneCalculeeService);
  private readonly excelLigneCalculeeService = inject(ExcelLigneCalculeeService);

  readonly societeId = signal<number | null>(null);
  readonly rapportId = signal<number | null>(null);
  readonly societeName = signal<string>('Société');
  readonly rapportType = signal<TypeRapport | null>(null);
  readonly rapportAnnee = signal<number | null>(null);

  readonly typeLabels: Record<TypeRapport, string> = { 0: 'REEL', 1: 'PREVISIONNEL', 2: 'CR' };

  readonly categories      = signal<CategorieFinanciere[]>([]);
  readonly sousCategories  = signal<SousCategorieFinanciere[]>([]);
  readonly lignes          = signal<LigneFinanciere[]>([]);
  readonly lignesCalculees = signal<LigneCalculee[]>([]);
  readonly loading         = signal(false);
  readonly cloning         = signal(false);
  readonly errorMessage    = signal<string | null>(null);

  readonly importFile    = signal<File | null>(null);
  readonly importing     = signal(false);
  readonly importMessage = signal<string | null>(null);
  readonly importError   = signal<string | null>(null);

  readonly showCategoryForm  = signal(false);
  readonly sousFormFor       = signal<number | null>(null);
  readonly ligneFormFor      = signal<number | null>(null);
  readonly editingCategory   = signal<CategorieFinanciere | null>(null);
  readonly editingSous       = signal<SousCategorieFinanciere | null>(null);
  readonly editingLigne      = signal<LigneFinanciere | null>(null);

  readonly cloneModalOpen        = signal(false);
  readonly cloneSources          = signal<{ id: number; label: string }[]>([]);
  readonly selectedCloneSourceId = signal<number | null>(null);

  readonly editingLigneCalculee = signal<LigneCalculee | null>(null);
  readonly calculeeColorModal = signal<string>(this.defaultColor);

  // Modal lignes calculées
  readonly showLigneCalculeeModal    = signal(false);
  readonly nomFormuleModal           = signal('');
  readonly selectedLignesWithOp      = signal<{ ligneId: number; ligneName: string; operator: string; type: 'financiere' | 'calculee' }[]>([]);
  readonly resultPreviewModal        = signal<number | null>(null);
  readonly errorMessageModal         = signal('');
  readonly formuleLoadingModal       = signal(false);
  readonly selectedCategorieIdModal  = signal<number | null>(null);
  readonly selectedSousCategorieIdModal = signal<number | null>(null);
  readonly calculeeResultCache = signal<Record<number, number>>({});
  readonly excelCodeModal            = signal<string>('');
  readonly excelMappings             = signal<Record<number, ExcelLigneCalculee>>({});

  // Modal placement
  readonly placementModalOpen          = signal(false);
  readonly placementEditingLigneId     = signal<number | null>(null);
  readonly placementCategorieId        = signal<number | null>(null);
  readonly placementSousCategorieId    = signal<number | null>(null);
  private draggingSousId: number | null = null;
  private draggingLigneId: number | null = null;

  // ===== LISTE MIXTE drag & drop global =====
  // NOTE: mixedOrder is still used as a runtime signal, but is now derived from
  // server-side positions on load (not from localStorage), ensuring consistency
  // across all users (admin and société).
  readonly mixedOrder = signal<{ type: 'categorie' | 'calculee'; id: number }[] | null>(null);

  get rapportTitle(): string {
    return this.headerTitle();
  }

  get backLink(): string[] {
    return ['/societe/societe-rapports'];
  }

  get importExcelLink(): (string | number)[] {
    return ['/societe/dashboard'];
  }

  get mixedBlocks(): MixedItem[] {
    return this.mixedItems();
  }

  get showCloneModal(): boolean {
    return this.cloneModalOpen();
  }

  get modalType(): 'category' | 'sous' | 'ligne' | 'calculee' | null {
    if (this.showCategoryForm()) return 'category';
    if (this.sousFormFor() != null) return 'sous';
    if (this.ligneFormFor() != null) return 'ligne';
    if (this.showLigneCalculeeModal()) return 'calculee';
    return null;
  }

  get modalTitle(): string {
    if (this.modalType === 'category') {
      return this.editingCategory() ? 'Modifier la catégorie' : 'Nouvelle catégorie';
    }
    if (this.modalType === 'sous') {
      return this.editingSous() ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie';
    }
    if (this.modalType === 'ligne') {
      return this.editingLigne() ? 'Modifier la ligne' : 'Nouvelle ligne';
    }
    if (this.modalType === 'calculee') {
      return this.editingLigneCalculee() ? 'Modifier la ligne calculée' : 'Nouvelle ligne calculée';
    }
    return '';
  }

  private getMixedOrderKey(): string {
    return `mixedOrder_rapport_${this.rapportId()}`;
  }

  // Keep localStorage only as a write-through cache for instant UI feel,
  // but on load we always prefer server positions.
  private saveMixedOrderToStorage(order: { type: 'categorie' | 'calculee'; id: number }[]): void {
    try { localStorage.setItem(this.getMixedOrderKey(), JSON.stringify(order)); } catch {}
  }

  private normalizeColorValue(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    return trimmed || this.defaultColor;
  }

  resolveColor(entity: { color?: string | null; couleur?: string | null } | null | undefined): string {
    const color = (entity?.color ?? '').trim();
    const couleur = (entity?.couleur ?? '').trim();
    return this.normalizeColorValue(color || couleur);
  }

  resolveTintColor(entity: { color?: string | null; couleur?: string | null } | null | undefined, alpha = 0.12): string {
    const color = this.resolveColor(entity);
    const normalized = color.replace('#', '').trim();

    if (normalized.length === 3) {
      const r = Number.parseInt(normalized[0] + normalized[0], 16);
      const g = Number.parseInt(normalized[1] + normalized[1], 16);
      const b = Number.parseInt(normalized[2] + normalized[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (normalized.length === 6) {
      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return color;
  }

  getColor(item: { color?: string | null; couleur?: string | null }): string {
    return this.resolveColor(item);
  }

  getTint(item: { color?: string | null; couleur?: string | null }): string {
    return this.resolveTintColor(item);
  }

  closeModal(): void {
    this.cancelCategory();
    this.cancelSousCategorie();
    this.cancelLigne();
    this.closeLigneCalculeeModal();
  }

  // ─── FIX: Build mixed order from server-side positions ───────
  // This replaces the old loadMixedOrderFromStorage() call in loadFinanceData.
  // By sorting categories and calculated lines together by their position field,
  // ALL users see the same order regardless of their browser/localStorage state.
  private buildMixedOrderFromServerPositions(
    cats: CategorieFinanciere[],
    calculees: LigneCalculee[]
  ): { type: 'categorie' | 'calculee'; id: number }[] {
    const allItems: { type: 'categorie' | 'calculee'; id: number; position: number }[] = [
      ...cats
        .filter(c => c.id != null)
        .map(c => ({ type: 'categorie' as const, id: c.id!, position: c.position ?? 0 })),
      ...calculees
        .filter(l => l.id != null)
        .map(l => ({ type: 'calculee' as const, id: l.id!, position: l.position ?? 0 }))
    ];

    return allItems
      .sort((a, b) => a.position - b.position)
      .map(item => ({ type: item.type, id: item.id }));
  }

  readonly mixedItems = computed((): MixedItem[] => {
    const cats      = this.categories();
    const calculees = this.lignesCalculees();
    const order     = this.mixedOrder();

    if (!order) {
      const result: MixedItem[] = [];
      cats.forEach((cat, i) => result.push({ type: 'categorie', data: cat, index: i }));
      calculees.forEach((lc, i) => result.push({ type: 'calculee', data: lc, index: i }));
      return result;
    }

    let calcIdx = 0;
    const orderedItems = order
      .map((ref): MixedItem | null => {
        if (ref.type === 'categorie') {
          const cat = cats.find(c => c.id === ref.id);
          return cat ? { type: 'categorie', data: cat, index: 0 } : null;
        } else {
          const lc = calculees.find(l => l.id === ref.id);
          const idx = calcIdx++;
          return lc ? { type: 'calculee', data: lc, index: idx } : null;
        }
      })
      .filter((x): x is MixedItem => x !== null);

    const seenCategoryIds = new Set(
      orderedItems
        .filter((item): item is Extract<MixedItem, { type: 'categorie' }> => item.type === 'categorie')
        .map(item => item.data.id)
    );
    const seenCalculeeIds = new Set(
      orderedItems
        .filter((item): item is Extract<MixedItem, { type: 'calculee' }> => item.type === 'calculee')
        .map(item => item.data.id)
    );

    cats.forEach(cat => {
      if (cat.id != null && !seenCategoryIds.has(cat.id)) {
        orderedItems.push({ type: 'categorie', data: cat, index: 0 });
      }
    });

    calculees.forEach(lc => {
      if (lc.id != null && !seenCalculeeIds.has(lc.id)) {
        orderedItems.push({ type: 'calculee', data: lc, index: calcIdx++ });
      }
    });

    return orderedItems;
  });

  readonly categoriesForModal = computed(() => this.categories());
  readonly sousCategoriesForModal = computed(() => {
    const categorieId = this.selectedCategorieIdModal();
    if (!categorieId) return [];
    return this.sousCategories().filter(s => s.categorieFinanciereId === categorieId);
  });
  readonly placementSousCategoriesForModal = computed(() => {
    const categorieId = this.placementCategorieId();
    if (!categorieId) return [];
    return this.sousCategories().filter(s => s.categorieFinanciereId === categorieId);
  });

  readonly isSociete = computed(() => sessionStorage.getItem('userType') === 'societe');

  readonly headerTitle = computed(() => {
    const type  = this.rapportType();
    const annee = this.rapportAnnee();
    const typeLabel = type !== null && type !== undefined ? this.typeLabels[type as TypeRapport] : '';
    return [typeLabel, annee].filter(Boolean).join(' · ');
  });

  readonly categoryForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    color: this.fb.control(this.defaultColor, { nonNullable: true })
  });
  readonly sousCategorieForm = this.fb.group({
    nom: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    color: this.fb.control(this.defaultColor, { nonNullable: true })
  });
  readonly ligneForm = this.fb.group({
    nom:    this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    unite:  this.fb.control('', { nonNullable: true }),
    montant: this.fb.control(0, { nonNullable: true, validators: [Validators.required] }),
    mois:   this.fb.control(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(12)] }),
    annee:  this.fb.control(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(1900)] }),
    color:  this.fb.control(this.defaultColor, { nonNullable: true })
  });

  // ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const societeIdParam = this.route.snapshot.paramMap.get('id');
    const rapportIdParam = this.route.snapshot.paramMap.get('rapportId');
    const societeId = societeIdParam ? Number(societeIdParam) : Number(sessionStorage.getItem('societeId'));
    const rapportId = rapportIdParam ? Number(rapportIdParam) : null;

    if (!societeId || Number.isNaN(societeId) || !rapportId || Number.isNaN(rapportId)) {
      this.router.navigate(['/societe/dashboard']);
      return;
    }
    this.societeId.set(societeId);
    this.rapportId.set(rapportId);
    this.loadSociete(societeId);
    this.loadRapport(rapportId);
    this.loadFinanceData(rapportId);
    this.loadCloneSources(societeId, rapportId);
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s: any) => this.societeName.set(s?.nom ?? 'Société'),
      error: () => this.societeName.set('Société')
    });
  }

  private loadRapport(id: number): void {
    this.rapportService.getById(id).subscribe({
      next: (r: unknown) => {
        const rapport = r as any;
        this.rapportType.set(rapport?.type ?? null);
        this.rapportAnnee.set(rapport?.annee ?? null);
      },
      error: () => { this.rapportType.set(null); this.rapportAnnee.set(null); }
    });
  }

  private loadCloneSources(societeId: number, currentRapportId: number): void {
    this.rapportService.getAll().subscribe({
      next: (all) => {
        const options = (all ?? [])
          .filter(r => r.societeId === societeId && r.id && r.id !== currentRapportId)
          .map(r => ({ id: r.id as number, label: `${this.typeLabels[r.type]} · ${r.annee}` }));
        this.cloneSources.set(options);
      },
      error: () => this.cloneSources.set([])
    });
  }

  private loadFinanceData(rapportId: number): void {
    this.loading.set(true);
    const previousCalculeesById = new Map(
      this.lignesCalculees()
        .filter((ligne): ligne is LigneCalculee & { id: number } => ligne.id != null)
        .map(ligne => [ligne.id, ligne.resultat] as const)
    );
    forkJoin([
      this.categorieService.getAll(),
      this.sousCategorieService.getAll(),
      this.ligneService.getAll(),
      this.ligneCalculeeService.getAll(),
      this.excelLigneCalculeeService.getAll()
    ]).subscribe({
      next: ([cats, sous, lignes, lignesCalculees, excelMappings]) => {
        const filteredCats = (cats ?? [])
          .filter(c => c.rapportFinancierId === rapportId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        this.categories.set(filteredCats);

        const catIds = new Set(filteredCats.map(c => c.id).filter(Boolean) as number[]);
        const filteredSous = (sous ?? [])
          .filter(sc => catIds.has(sc.categorieFinanciereId))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        this.sousCategories.set(filteredSous);

        const sousIds = new Set(filteredSous.map(sc => sc.id).filter(Boolean) as number[]);
        this.lignes.set(
          (lignes ?? [])
            .filter(l => sousIds.has(l.sousCategorieFinanciereId))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        );

        const societeId = this.societeId();
        const filteredCalculees = (lignesCalculees ?? [])
          .filter(l => {
            // FIX: exiger que rapportFinancierId corresponde exactement au rapport courant
            // (avant, les lignes sans rapportFinancierId passaient le filtre par erreur)
            return l.rapportFinancierId === rapportId;
          })
          .map(l => ({
            ...l,
            resultat: l.resultat ?? (l.id != null ? previousCalculeesById.get(l.id) : undefined) ?? (l.id != null ? this.calculeeResultCache()[l.id] : undefined) ?? null
          }))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        this.lignesCalculees.set(filteredCalculees);

        this.calculeeResultCache.set(
          filteredCalculees.reduce<Record<number, number>>((cache, ligne) => {
            if (ligne.id != null && ligne.resultat != null) {
              cache[ligne.id] = ligne.resultat;
            }
            return cache;
          }, { ...this.calculeeResultCache() })
        );

        // Charger les mappings Excel
        const excelMappingsById: Record<number, ExcelLigneCalculee> = {};
        (excelMappings ?? []).forEach(mapping => {
          if (mapping.ligneCalculeeId) {
            excelMappingsById[mapping.ligneCalculeeId] = mapping;
          }
        });
        this.excelMappings.set(excelMappingsById);

        // Recalculer localement les résultats des lignes calculées
        // pour refléter immédiatement les changements de montants sans attendre le serveur
        this.recomputeAllLignesCalculees();

        // ─── FIX: Derive order from server positions (shared across all users) ───
        // Previously used localStorage which caused different users to see
        // different orderings. Now we always compute from server position fields.
        // DEBUG
        console.log('=== CATS positions ===');
        console.table(filteredCats.map(c => ({ nom: c.nom, position: c.position })));
        console.log('=== CALCULEES positions ===');
        console.table(filteredCalculees.map(l => ({ nom: l.nom, position: l.position })));

        const serverOrder = this.buildMixedOrderFromServerPositions(filteredCats, filteredCalculees);
        console.log('=== SERVER ORDER ===');
        console.table(serverOrder);
        this.mixedOrder.set(serverOrder);
        // Also persist to localStorage so subsequent drag-drops work smoothly
        this.saveMixedOrderToStorage(serverOrder);
      },
      error: () => {
        this.categories.set([]);
        this.sousCategories.set([]);
        this.lignes.set([]);
        this.lignesCalculees.set([]);
      },
      complete: () => this.loading.set(false)
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────
  sousFor(categorieId: number | undefined): SousCategorieFinanciere[] {
    if (!categorieId) return [];
    return this.sousCategories()
      .filter(sc => sc.categorieFinanciereId === categorieId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  lignesFor(sousCategorieId: number | undefined): LigneFinanciere[] {
    if (!sousCategorieId) return [];
    return this.lignes()
      .filter(l => l.sousCategorieFinanciereId === sousCategorieId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // ─── Helper: compute next global position across all mixed items ──
  // This ensures new items are always appended after all existing items,
  // maintaining consistent ordering for all users.
  private getNextGlobalPosition(): number {
    const maxCat = Math.max(...this.categories().map(c => c.position ?? 0), -1);
    const maxCalc = Math.max(...this.lignesCalculees().map(l => l.position ?? 0), -1);
    return Math.max(maxCat, maxCalc) + 1;
  }

  // ─── Catégories ───────────────────────────────────────────────
  openCategoryForm(): void {
    if (this.isSociete()) return;
    this.showCategoryForm.set(true);
    this.editingCategory.set(null);
    this.categoryForm.reset({ nom: '', color: this.defaultColor });
  }

  openCategoryModal(item?: CategorieFinanciere): void {
    if (item) {
      this.editCategory(item);
      return;
    }
    this.openCategoryForm();
  }

  editCategory(cat: CategorieFinanciere): void {
    if (this.isSociete()) return;
    this.showCategoryForm.set(true);
    this.editingCategory.set(cat);
    this.categoryForm.reset({ nom: cat.nom ?? '', color: this.resolveColor(cat) });
  }

  saveCategory(): void {
    if (this.isSociete()) return;
    if (this.categoryForm.invalid) { this.categoryForm.markAllAsTouched(); return; }
    const rapportId = this.rapportId();
    if (!rapportId) return;

    const editing = this.editingCategory();

    // ─── FIX: Use global position so new categories are interleaved correctly ──
    const position = editing ? (editing.position ?? 0) : this.getNextGlobalPosition();

    const payload: CategorieFinanciere = {
      nom: this.categoryForm.value.nom?.trim() ?? '',
      rapportFinancierId: rapportId,
      position,
      color: this.categoryForm.value.color ?? this.defaultColor,
      couleur: this.categoryForm.value.color ?? this.defaultColor
    };
    const req$: Observable<unknown> = editing?.id
      ? this.categorieService.update(editing.id, { ...editing, ...payload })
      : this.categorieService.create(payload);
    req$.subscribe({ next: () => this.loadFinanceData(rapportId), complete: () => { this.showCategoryForm.set(false); this.editingCategory.set(null); } });
  }

  deleteCategory(cat: CategorieFinanciere): void {
    if (this.isSociete() || !cat.id) return;
    const rapportId = this.rapportId();
    this.categorieService.delete(cat.id).subscribe({ next: () => rapportId && this.loadFinanceData(rapportId) });
  }

  cancelCategory(): void { this.showCategoryForm.set(false); this.editingCategory.set(null); }

  // ─── Sous-catégories ──────────────────────────────────────────
  openSousForm(categorieId: number | undefined, sous?: SousCategorieFinanciere): void {
    if (this.isSociete() || !categorieId) return;
    this.sousFormFor.set(categorieId);
    this.editingSous.set(sous ?? null);
    this.sousCategorieForm.reset({ nom: sous?.nom ?? '', color: this.resolveColor(sous) });
  }

  openSousModal(categorieId: number, item?: SousCategorieFinanciere): void {
    this.openSousForm(categorieId, item);
  }

  saveSousCategorie(): void {
    if (this.isSociete()) return;
    const categorieId = this.sousFormFor();
    if (!categorieId || this.sousCategorieForm.invalid) { this.sousCategorieForm.markAllAsTouched(); return; }
    const payload: SousCategorieFinanciere = {
      nom: this.sousCategorieForm.value.nom?.trim() ?? '',
      categorieFinanciereId: categorieId,
      position: this.sousFor(categorieId).length,
      color: this.sousCategorieForm.value.color ?? this.defaultColor,
      couleur: this.sousCategorieForm.value.color ?? this.defaultColor
    };
    const editing = this.editingSous();
    const req$: Observable<unknown> = editing?.id
      ? this.sousCategorieService.update(editing.id, { ...editing, ...payload })
      : this.sousCategorieService.create(payload);
    req$.subscribe({
      next: () => { const r = this.rapportId(); if (r) this.loadFinanceData(r); },
      complete: () => { this.sousFormFor.set(null); this.editingSous.set(null); }
    });
  }

  deleteSousCategorie(sous: SousCategorieFinanciere): void {
    if (this.isSociete() || !sous.id) return;
    const rapportId = this.rapportId();
    this.sousCategorieService.delete(sous.id).subscribe({ next: () => rapportId && this.loadFinanceData(rapportId) });
  }

  deleteSous(sous: SousCategorieFinanciere): void {
    this.deleteSousCategorie(sous);
  }

  cancelSousCategorie(): void { this.sousFormFor.set(null); this.editingSous.set(null); }

  // ─── Lignes financières ───────────────────────────────────────
  openLigneForm(sousCategorieId: number | undefined, ligne?: LigneFinanciere): void {
    if (!sousCategorieId) return;
    if (this.isSociete() && !ligne) return;
    this.ligneFormFor.set(sousCategorieId);
    this.editingLigne.set(ligne ?? null);
    this.ligneForm.reset({ nom: ligne?.nom ?? '', unite: ligne?.unite ?? '', montant: ligne?.montant ?? 0, mois: ligne?.mois ?? 1, annee: ligne?.annee ?? new Date().getFullYear(), color: this.resolveColor(ligne) });
    if (this.isSociete()) {
      this.ligneForm.get('nom')?.disable(); this.ligneForm.get('unite')?.disable();
      this.ligneForm.get('mois')?.disable(); this.ligneForm.get('annee')?.disable();
      this.ligneForm.get('color')?.disable();
      this.ligneForm.get('montant')?.enable();
    } else { this.ligneForm.enable(); }
  }

  openLigneModal(sousCategorieId: number, ligne?: LigneFinanciere): void {
    this.openLigneForm(sousCategorieId, ligne);
  }

  saveLigne(): void {
    const sousCategorieId = this.ligneFormFor();
    if (!sousCategorieId || this.ligneForm.invalid) { this.ligneForm.markAllAsTouched(); return; }
    const raw = this.ligneForm.getRawValue();
    const editing = this.editingLigne();
    if (this.isSociete()) {
      if (!editing?.id) return;
      this.ligneService.patchMontant(editing.id, Number(raw.montant ?? editing.montant ?? 0)).subscribe({
        next: () => { const r = this.rapportId(); if (r) this.loadFinanceData(r); },
        complete: () => { this.ligneFormFor.set(null); this.editingLigne.set(null); }
      });
      return;
    }
    const payload: LigneFinanciere = {
      nom: raw.nom?.trim() ?? '',
      unite: raw.unite?.trim() ?? '',
      montant: Number(raw.montant ?? 0),
      mois: Number(raw.mois ?? 1),
      annee: Number(raw.annee ?? new Date().getFullYear()),
      sousCategorieFinanciereId: sousCategorieId,
      position: this.lignesFor(sousCategorieId).length,
      color: raw.color ?? this.defaultColor,
      couleur: raw.color ?? this.defaultColor
    };
    const req$: Observable<unknown> = editing?.id ? this.ligneService.update(editing.id, { ...editing, ...payload }) : this.ligneService.create(payload);
    req$.subscribe({
      next: () => { const r = this.rapportId(); if (r) this.loadFinanceData(r); },
      complete: () => { this.ligneFormFor.set(null); this.editingLigne.set(null); }
    });
  }

  deleteLigne(ligne: LigneFinanciere): void {
    if (this.isSociete() || !ligne.id) return;
    const rapportId = this.rapportId();
    this.ligneService.delete(ligne.id).subscribe({ next: () => rapportId && this.loadFinanceData(rapportId) });
  }

  deleteCalculee(ligne: LigneCalculee): void {
    this.deleteLigneCalculee(ligne);
  }

  cancelLigne(): void { this.ligneFormFor.set(null); this.editingLigne.set(null); }

  // ─── Excel import ─────────────────────────────────────────────
  onExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
    this.importMessage.set(null); this.importError.set(null);
  }

  importFromExcel(): void {
    if (this.isSociete()) { this.importError.set('Import Excel réservé à l\'administrateur.'); return; }
    const file = this.importFile(); const rapportId = this.rapportId();
    if (!file || !rapportId) { this.importError.set('Choisissez un fichier Excel.'); return; }
    this.importing.set(true); this.importMessage.set(null); this.importError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result as ArrayBuffer, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true }) as any[][];
        this.applyValuesFromMap(this.buildLabelValueMap(rows));
      } catch { this.importError.set('Lecture du fichier impossible.'); this.importing.set(false); }
    };
    reader.onerror = () => { this.importError.set('Lecture du fichier impossible.'); this.importing.set(false); };
    reader.readAsArrayBuffer(file);
  }

  private buildLabelValueMap(rows: any[][]): Map<string, number> {
    const map = new Map<string, number>();
    rows.forEach(row => {
      const labelIndex = row.findIndex(cell => typeof cell === 'string' && this.normalizeLabel(cell) !== '');
      if (labelIndex === -1) return;
      const label = this.normalizeLabel(String(row[labelIndex]));
      const candidate = [...row.slice(labelIndex + 1)].reverse().find(cell => typeof cell === 'number' || (typeof cell === 'string' && cell.trim() !== ''));
      if (candidate === undefined || candidate === null) return;
      let value: number | null = null;
      if (typeof candidate === 'number') { value = candidate; }
      else if (typeof candidate === 'string') { const p = Number(candidate.replace(/\s+/g, '').replace(',', '.')); if (!Number.isNaN(p)) value = p; }
      if (value !== null) map.set(label, value);
    });
    return map;
  }

  private applyValuesFromMap(map: Map<string, number>): void {
    const rapportId = this.rapportId();
    if (!rapportId) { this.importing.set(false); return; }
    const ligneLookup = new Map<string, LigneFinanciere>();
    for (const ligne of this.lignes()) { if (!ligne.id) continue; const k = this.normalizeLabel(ligne.nom ?? ''); if (k) ligneLookup.set(k, ligne); }
    const updates: Observable<unknown>[] = [];
    for (const [label, value] of map.entries()) { const ex = ligneLookup.get(label); if (ex?.id) updates.push(this.ligneService.patchMontant(ex.id, value)); }
    if (!updates.length) { this.importing.set(false); this.importMessage.set('Aucune ligne correspondante trouvée.'); return; }
    forkJoin(updates).subscribe({
      next: () => this.importMessage.set(`Montants mis à jour (${updates.length} lignes).`),
      error: () => { this.importError.set('Échec lors de la mise à jour des montants.'); this.importing.set(false); },
      complete: () => { this.importing.set(false); this.loadFinanceData(rapportId); }
    });
  }

  private normalizeLabel(label: string): string {
    return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
  }

  private normalizeCodePart(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private buildGeneratedLineCode(ligneId: number): string {
    const ligne = this.lignes().find(l => l.id === ligneId);
    if (!ligne) return '';

    const sous = this.sousCategories().find(s => s.id === ligne.sousCategorieFinanciereId);
    if (!sous) return '';

    const categorieId = sous.categorieFinanciereId;
    const sousCategorieId = sous.id;
    const lineNamePart = this.normalizeCodePart(ligne.nom ?? 'ligne');
    if (!lineNamePart) return '';

    return `c${categorieId}s${sousCategorieId}${lineNamePart}`;
  }

  private getSelectionToken(item: { ligneId: number; ligneName: string; type: 'financiere' | 'calculee' }): string {
    if (item.type === 'financiere') {
      const code = this.buildGeneratedLineCode(item.ligneId);
      if (code) return code;
    }

    return `[${item.ligneName}]`;
  }

  private findLigneByGeneratedCode(code: string): LigneFinanciere | null {
    const target = code.toLowerCase();
    for (const ligne of this.lignes()) {
      if (!ligne.id) continue;
      if (this.buildGeneratedLineCode(ligne.id).toLowerCase() === target) {
        return ligne;
      }
    }
    return null;
  }

  private findLigneCalculeeByName(name: string): LigneCalculee | null {
    const target = this.normalizeCodePart(name);
    return this.lignesCalculees().find(ligne => this.normalizeCodePart(ligne.nom ?? '') === target) ?? null;
  }

  // ─── TrackBy ──────────────────────────────────────────────────
  trackByCategorie(_i: number, cat: CategorieFinanciere): number | undefined { return cat.id; }
  trackBySousCategorie(_i: number, s: SousCategorieFinanciere): number | undefined { return s.id; }
  trackByLigne(_i: number, l: LigneFinanciere): number | undefined { return l.id; }
  trackByLigneCalculee(_i: number, l: LigneCalculee): number | undefined { return l.id; }
  trackByMixedItem(_i: number, item: MixedItem): string { return `${item.type}-${item.data.id}`; }

  // ─── Clone ────────────────────────────────────────────────────
  openCloneModal(): void {
    if (this.isSociete()) return;
    const societeId = this.societeId(); const rapportId = this.rapportId();
    if (!this.cloneSources().length && societeId && rapportId) this.loadCloneSources(societeId, rapportId);
    this.cloneModalOpen.set(true);
  }

  cancelClone(): void { 
    this.cloneModalOpen.set(false); 
    this.selectedCloneSourceId.set(null); 
    this.cloning.set(false); 
  }
  onSelectCloneSource(id: number | null): void { this.selectedCloneSourceId.set(id); }

  confirmClone(): void {
    const targetId = this.rapportId(); const sourceId = this.selectedCloneSourceId();
    if (!targetId || !sourceId) return;
    this.cloning.set(true);
    forkJoin([
      this.categorieService.getAll(),
      this.sousCategorieService.getAll(),
      this.ligneService.getAll(),
      this.ligneCalculeeService.getAll()
    ]).subscribe({
      next: ([cats, sous, lignes, lignesCalculees]) => {
        const sourceCats = (cats ?? [])
          .filter(c => c.rapportFinancierId === sourceId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const sourceCalculees = (lignesCalculees ?? [])
          .filter(l => l.rapportFinancierId === sourceId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const sourceMixed = [
          ...sourceCats
            .filter(c => c.id != null)
            .map(c => ({ type: 'categorie' as const, id: c.id as number, position: c.position ?? 0 })),
          ...sourceCalculees
            .filter(l => l.id != null)
            .map(l => ({ type: 'calculee' as const, id: l.id as number, position: l.position ?? 0 }))
        ].sort((a, b) => a.position - b.position);

        const catNewPositions = new Map<number, number>();
        const calcNewPositions = new Map<number, number>();
        sourceMixed.forEach((item, index) => {
          if (item.type === 'categorie') catNewPositions.set(item.id, index);
          else calcNewPositions.set(item.id, index);
        });

        // ─── FIX POSITION GLOBALE ─────────────────────────────────────────────
        // Reconstruire la liste mixte source (cats + calculées) triée par position,
        // puis assigner des index globaux séquentiels 0,1,2,3...
        // Cela garantit que dans le rapport cible, l'ordre est identique à la source.
        // Les positions source sont déjà globales et entrelacées (cat pos=1, calc pos=2, cat pos=3...)
        // Il suffit de les copier directement dans le rapport cible.

        // DEBUG - afficher l'ordre final qui sera créé dans le rapport cible
        const debugMixed = [
          ...sourceCats.map(c => ({ type: 'categorie', nom: c.nom, position_source: c.position })),
          ...sourceCalculees.map(lc => ({ type: 'calculee', nom: lc.nom, position_source: lc.position }))
        ].sort((a, b) => (a.position_source ?? 0) - (b.position_source ?? 0));
        console.log('=== ORDRE FINAL DU CLONE ===');
        console.table(debugMixed);

        if (!sourceCats.length) {
          this.cloneCalculatedLines(targetId, sourceCalculees, new Map(), new Map(), new Map(), calcNewPositions);
          return;
        }

        forkJoin(sourceCats.map(c => this.categorieService.create({
          nom: c.nom ?? '',
          rapportFinancierId: targetId,
          position: c.id != null ? (catNewPositions.get(c.id) ?? c.position ?? 0) : (c.position ?? 0),
          color: this.resolveColor(c),
          couleur: this.resolveColor(c)
        }))).subscribe({
          next: (newCats) => {
            const catIdMap = new Map<number, number>();
            sourceCats.forEach((c, i) => { if (c.id && newCats[i]?.id) catIdMap.set(c.id, newCats[i].id as number); });

            // FIX: forcer les positions correctes des catégories (backend peut ignorer position à la création)
            const catPositionUpdates = newCats
              .map((created, i) => {
                if (!created?.id) return null;
                const sourceCat = sourceCats[i];
                const sourcePos = sourceCat?.id != null
                  ? (catNewPositions.get(sourceCat.id) ?? sourceCat.position ?? 0)
                  : (sourceCat?.position ?? 0);
                return this.categorieService.update(created.id, {
                  ...created,
                  id: created.id,
                  nom: created.nom ?? '',
                  rapportFinancierId: targetId,
                  position: sourcePos
                });
              })
              .filter((u): u is NonNullable<typeof u> => u != null);

            // Forcer les positions correctes des catégories puis continuer le clone
            const continueClone = () => {
              const sourceSous = (sous ?? [])
                .filter(sc => catIdMap.has(sc.categorieFinanciereId))
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

              if (!sourceSous.length) {
                this.cloneCalculatedLines(targetId, sourceCalculees, catIdMap, new Map(), new Map(), calcNewPositions);
                return;
              }

              forkJoin(sourceSous.map(sc => this.sousCategorieService.create({
                nom: sc.nom ?? '',
                categorieFinanciereId: catIdMap.get(sc.categorieFinanciereId) as number,
                position: sc.position ?? 0,
                color: this.resolveColor(sc),
                couleur: this.resolveColor(sc)
              }))).subscribe({
                next: (newSous) => {
                  const sousIdMap = new Map<number, number>();
                  sourceSous.forEach((sc, i) => { if (sc.id && newSous[i]?.id) sousIdMap.set(sc.id, newSous[i].id as number); });

                  const sousPositionUpdates = newSous
                    .map((created, i) => {
                      if (!created?.id) return null;
                      const sourcePos = sourceSous[i]?.position ?? 0;
                      return this.sousCategorieService.update(created.id, {
                        ...created,
                        id: created.id,
                        position: sourcePos
                      });
                    })
                    .filter((u): u is NonNullable<typeof u> => u != null);

                  const continueWithLignes = () => {
                    const sourceLignes = (lignes ?? [])
                      .filter(l => sousIdMap.has(l.sousCategorieFinanciereId))
                      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

                    if (!sourceLignes.length) {
                      this.cloneCalculatedLines(targetId, sourceCalculees, catIdMap, sousIdMap, new Map(), calcNewPositions);
                      return;
                    }

                    const targetYear = this.rapportAnnee();
                    forkJoin(sourceLignes.map(l => this.ligneService.create({
                      nom: l.nom ?? '',
                      unite: l.unite ?? '',
                      montant: 0,
                      mois: l.mois,
                      annee: targetYear ?? l.annee,
                      sousCategorieFinanciereId: sousIdMap.get(l.sousCategorieFinanciereId) as number,
                      position: l.position ?? 0,
                      color: this.resolveColor(l),
                      couleur: this.resolveColor(l)
                    }))).subscribe({
                      next: (createdLines) => {
                        const lineIdMap = new Map<number, number>();
                        sourceLignes.forEach((l, i) => { if (l.id && createdLines[i]?.id) lineIdMap.set(l.id, createdLines[i].id as number); });

                        const linePositionUpdates = createdLines
                          .map((created, i) => {
                            if (!created?.id) return null;
                            const sourcePos = sourceLignes[i]?.position ?? 0;
                            return this.ligneService.update(created.id, {
                              ...created,
                              id: created.id,
                              position: sourcePos
                            });
                          })
                          .filter((u): u is NonNullable<typeof u> => u != null);

                        if (linePositionUpdates.length) {
                          forkJoin(linePositionUpdates).subscribe({
                            next: () => this.cloneCalculatedLines(targetId, sourceCalculees, catIdMap, sousIdMap, lineIdMap, calcNewPositions),
                            error: () => this.cloneCalculatedLines(targetId, sourceCalculees, catIdMap, sousIdMap, lineIdMap, calcNewPositions)
                          });
                        } else {
                          this.cloneCalculatedLines(targetId, sourceCalculees, catIdMap, sousIdMap, lineIdMap, calcNewPositions);
                        }
                      },
                      error: () => this.finishClone(targetId)
                    });
                  };

                  if (sousPositionUpdates.length) {
                    forkJoin(sousPositionUpdates).subscribe({
                      next: () => continueWithLignes(),
                      error: () => continueWithLignes()
                    });
                  } else {
                    continueWithLignes();
                  }
                },
                error: () => this.finishClone(targetId)
              });
            };

            if (catPositionUpdates.length) {
              forkJoin(catPositionUpdates).subscribe({
                next: () => continueClone(),
                error: () => continueClone()
              });
            } else {
              continueClone();
            }
          },
          error: () => this.finishClone(targetId)
        });
      },
      error: () => this.finishClone(targetId)
    });
  }

  private cloneCalculatedLines(
    targetRapportId: number,
    sourceCalculees: LigneCalculee[],
    catIdMap: Map<number, number>,
    sousIdMap: Map<number, number>,
    lineIdMap: Map<number, number>,
    calcNewPositions: Map<number, number>
  ): void {
    if (!sourceCalculees.length) {
      this.finishClone(targetRapportId);
      return;
    }

    const replaceCategorySousIds = (expression: string): string => {
      return (expression ?? '').replace(/c(\d+)s(\d+)([a-z0-9]+)/gi, (_m, catIdStr: string, sousIdStr: string, suffix: string) => {
        const oldCatId = Number(catIdStr);
        const oldSousId = Number(sousIdStr);
        const newCatId = catIdMap.get(oldCatId) ?? oldCatId;
        const newSousId = sousIdMap.get(oldSousId) ?? oldSousId;
        return `c${newCatId}s${newSousId}${suffix}`;
      });
    };

    const replaceLegacyLineIds = (expression: string): string => {
      return (expression ?? '').replace(/\b\d+\b/g, (token: string) => {
        const oldLineId = Number(token);
        const newLineId = lineIdMap.get(oldLineId);
        return newLineId != null ? String(newLineId) : token;
      });
    };

    const calcPayloads = sourceCalculees.map(lc => ({
      nom: lc.nom,
      expression: replaceLegacyLineIds(replaceCategorySousIds(lc.expression)),
      // Position globale pré-calculée dans confirmClone (interleaved avec les cats)
      position: lc.id != null ? (calcNewPositions.get(lc.id) ?? lc.position ?? 0) : (lc.position ?? 0),
      resultat: 0,
      dateCreation: new Date().toISOString(),
      societeId: this.societeId() ?? undefined,
      rapportFinancierId: targetRapportId,
      categorieFinanciereId: lc.categorieFinanciereId != null ? (catIdMap.get(lc.categorieFinanciereId) ?? undefined) : undefined,
      sousCategorieFinanciereId: lc.sousCategorieFinanciereId != null ? (sousIdMap.get(lc.sousCategorieFinanciereId) ?? undefined) : undefined,
      color: this.resolveColor(lc),
      couleur: this.resolveColor(lc)
    }));

    const creates = calcPayloads.map(payload => this.ligneCalculeeService.create(payload));

    const applyPositionUpdates = (updates: { id: number; position: number }[]) => {
      if (!updates.length) {
        this.finishClone(targetRapportId);
        return;
      }

      const targetPositions = new Map<number, number>(updates.map(item => [item.id, item.position]));
      this.ligneCalculeeService.getAll().subscribe({
        next: (allCalculees) => {
          const strictUpdates = (allCalculees ?? [])
            .filter(item => item.id != null && targetPositions.has(item.id))
            .map(item => this.ligneCalculeeService.update({
              ...item,
              id: item.id,
              position: targetPositions.get(item.id as number)
            }));

          if (!strictUpdates.length) {
            this.finishClone(targetRapportId);
            return;
          }

          forkJoin(strictUpdates).subscribe({
            next: () => this.finishClone(targetRapportId),
            error: () => this.finishClone(targetRapportId)
          });
        },
        error: () => this.finishClone(targetRapportId)
      });
    };

    forkJoin(creates).subscribe({
      next: (createdLines) => {
        const positionUpdates = createdLines
          .map((created, i) => {
            const source = sourceCalculees[i];
            const correctPosition = source?.id != null
              ? (calcNewPositions.get(source.id) ?? source.position ?? 0)
              : (source?.position ?? 0);
            return created?.id != null ? { id: created.id, position: correctPosition } : null;
          })
          .filter((item): item is { id: number; position: number } => item != null);

        if (positionUpdates.length === sourceCalculees.length) {
          applyPositionUpdates(positionUpdates);
          return;
        }

        const normalize = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();
        this.ligneCalculeeService.getAll().subscribe({
          next: (allCalculees) => {
            const targetCandidates = (allCalculees ?? [])
              .filter(item => item.rapportFinancierId === targetRapportId && item.id != null)
              .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

            const usedIds = new Set(positionUpdates.map(item => item.id));
            const recoveredUpdates = calcPayloads
              .map((payload, i) => {
                if (createdLines[i]?.id != null) return null;

                const source = sourceCalculees[i];
                const correctPosition = source?.id != null
                  ? (calcNewPositions.get(source.id) ?? source.position ?? 0)
                  : (source?.position ?? 0);

                const matchIndex = targetCandidates.findIndex(candidate => {
                  if (candidate.id == null || usedIds.has(candidate.id)) return false;
                  return normalize(candidate.nom) === normalize(payload.nom)
                    && (candidate.expression ?? '').trim() === (payload.expression ?? '').trim();
                });

                if (matchIndex < 0) return null;

                const [matched] = targetCandidates.splice(matchIndex, 1);
                if (!matched?.id) return null;
                usedIds.add(matched.id);
                return { id: matched.id, position: correctPosition };
              })
              .filter((item): item is { id: number; position: number } => item != null);

            applyPositionUpdates([...positionUpdates, ...recoveredUpdates]);
          },
          error: () => applyPositionUpdates(positionUpdates)
        });
      },
      error: () => this.finishClone(targetRapportId)
    });
  }


  /**
   * Recalcule localement les résultats de toutes les lignes calculées
   * en parsant leur expression avec les montants actuels des lignes financières.
   * Appelé après chaque modification de montant pour mise à jour instantanée.
   */
  private recomputeAllLignesCalculees(): void {
    const lignes = this.lignes();
    const lignesCalc = this.lignesCalculees();
    if (!lignesCalc.length) return;

    // Map: code généré -> montant (pour les lignes financières)
    const montantByCode = new Map<string, number>();
    for (const l of lignes) {
      if (!l.id) continue;
      const code = this.buildGeneratedLineCode(l.id);
      if (code) montantByCode.set(code.toLowerCase(), Number(l.montant ?? 0));
    }

    // Map: id calculée -> résultat (pour les lignes calculées référencées dans d'autres)
    // On trie par position pour résoudre les dépendances dans l'ordre
    const resultatById = new Map<number, number>();

    const sorted = [...lignesCalc].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const evaluateExpression = (expression: string): number => {
      if (!expression?.trim()) return 0;

      // Remplacer les codes c{cat}s{sous}{nom} par leurs montants
      let expr = expression.replace(/c(\d+)s(\d+)([a-z0-9]+)/gi, (_m, _c, _s, _n) => {
        const code = _m.toLowerCase();
        return String(montantByCode.get(code) ?? 0);
      });

      // Remplacer les références [NomLigneCalculée] par leurs résultats
      expr = expr.replace(/\[([^\]]+)\]/g, (_m, nom) => {
        const normalized = nom.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
        for (const lc of sorted) {
          const lcNorm = (lc.nom ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (lcNorm === normalized && lc.id != null) {
            return String(resultatById.get(lc.id) ?? lc.resultat ?? 0);
          }
        }
        return '0';
      });

      // Évaluer l'expression arithmétique simple
      try {
        // Sécurité: n'autoriser que les chiffres et opérateurs
        if (!/^[\d\s+\-*/.()]+$/.test(expr)) return 0;
        // eslint-disable-next-line no-eval
        const result = Function('"use strict"; return (' + expr + ')')();
        return typeof result === 'number' && isFinite(result) ? result : 0;
      } catch {
        return 0;
      }
    };

    const updated = sorted.map(lc => {
      const result = evaluateExpression(lc.expression ?? '');
      if (lc.id != null) resultatById.set(lc.id, result);
      return { ...lc, resultat: result };
    });

    this.lignesCalculees.set(updated);
    this.calculeeResultCache.set(
      updated.reduce<Record<number, number>>((cache, lc) => {
        if (lc.id != null) cache[lc.id] = lc.resultat ?? 0;
        return cache;
      }, { ...this.calculeeResultCache() })
    );

    // ─── Persist updated results to database ────────────────────────────────
    // Without this, resultat is recalculated locally but never saved to the DB,
    // so refreshing the page or viewing from another session shows stale values.
    const persistRequests = updated
      .filter(lc => lc.id != null)
      .map(lc =>
        this.ligneCalculeeService.update({
          id: lc.id as number,
          nom: lc.nom ?? '',
          expression: lc.expression ?? '',
          position: lc.position,         // preserve existing position
          resultat: lc.resultat ?? 0,
          categorieFinanciereId: lc.categorieFinanciereId ?? null,
          sousCategorieFinanciereId: lc.sousCategorieFinanciereId ?? null,
          // Preserve any existing color so periodic persistence doesn't wipe it out
          color: (lc as any).color ?? (lc as any).couleur ?? null,
          couleur: (lc as any).color ?? (lc as any).couleur ?? null
        })
      );

    if (persistRequests.length > 0) {
      forkJoin(persistRequests).subscribe({
        error: (err) => console.warn('Failed to persist lignes calculées results:', err)
      });
    }
  }

  private finishClone(rapportId: number): void {
    this.loadFinanceData(rapportId); this.cloning.set(false);
    this.cloneModalOpen.set(false); this.selectedCloneSourceId.set(null);
  }

  // ─── Modal lignes calculées (CRÉER + MODIFIER) ───────────────

  openLigneCalculeeModal(): void {
    if (this.isSociete()) return;
    this.editingLigneCalculee.set(null);
    this.showLigneCalculeeModal.set(true);
    this.nomFormuleModal.set('');
    this.calculeeColorModal.set(this.defaultColor);
    this.selectedLignesWithOp.set([]);
    this.resultPreviewModal.set(null);
    this.errorMessageModal.set('');
    this.selectedCategorieIdModal.set(null);
    this.selectedSousCategorieIdModal.set(null);
    this.excelCodeModal.set('');
  }

  openCalculeeModal(item?: LigneCalculee): void {
    if (item) {
      this.openEditLigneCalculeeModal(item);
      return;
    }
    this.openLigneCalculeeModal();
  }

  openEditLigneCalculeeModal(ligne: LigneCalculee): void {
    if (this.isSociete()) return;
    this.editingLigneCalculee.set(ligne);
    this.showLigneCalculeeModal.set(true);
    this.nomFormuleModal.set(ligne.nom);
    this.calculeeColorModal.set(this.resolveColor(ligne));
    this.errorMessageModal.set('');
    this.resultPreviewModal.set(ligne.resultat ?? null);
    this.selectedCategorieIdModal.set(ligne.categorieFinanciereId ?? null);
    this.selectedSousCategorieIdModal.set(ligne.sousCategorieFinanciereId ?? null);
    this.loadExcelCodeForLigne(ligne.id);

    this.rebuildSelectionFromExpression(ligne.expression);
  }

  private rebuildSelectionFromExpression(expression: string): void {
    const result: { ligneId: number; ligneName: string; operator: string; type: 'financiere' | 'calculee' }[] = [];
    const codeRegex = /([+\-*\/]?)\s*(c\d+s\d+[a-z0-9]*)/gi;
    let match: RegExpExecArray | null;
    let isFirst = true;

    while ((match = codeRegex.exec(expression)) !== null) {
      const operator = isFirst ? '+' : (match[1]?.trim() || '+');
      const code = match[2].trim();
      const ligne = this.findLigneByGeneratedCode(code);
      if (ligne?.id) {
        result.push({ ligneId: ligne.id, ligneName: ligne.nom ?? 'Ligne', operator, type: 'financiere' });
      }
      isFirst = false;
    }

    if (!result.length) {
      const legacyRegex = /([+\-*\/]?)\s*\[([^\]]+)\]/g;
      isFirst = true;

      while ((match = legacyRegex.exec(expression)) !== null) {
        const operator = isFirst ? '+' : (match[1]?.trim() || '+');
        const ligneName = match[2].trim();
        const ligne = this.lignes().find(l => l.nom === ligneName);
        if (ligne?.id) {
          result.push({ ligneId: ligne.id, ligneName, operator, type: 'financiere' });
        } else {
          const calculee = this.findLigneCalculeeByName(ligneName);
          if (calculee?.id) {
            result.push({ ligneId: calculee.id, ligneName, operator, type: 'calculee' });
          }
        }
        isFirst = false;
      }
    }

    this.selectedLignesWithOp.set(result);
    this.calculatePreviewModal();
  }

  closeLigneCalculeeModal(): void {
    this.showLigneCalculeeModal.set(false);
    this.editingLigneCalculee.set(null);
    this.nomFormuleModal.set('');
    this.calculeeColorModal.set(this.defaultColor);
    this.selectedLignesWithOp.set([]);
    this.resultPreviewModal.set(null);
    this.errorMessageModal.set('');
    this.selectedCategorieIdModal.set(null);
    this.selectedSousCategorieIdModal.set(null);
    this.excelCodeModal.set('');
  }

  // ─── Excel Code Mapping ──────────────────────────────────────

  /**
   * Charger le code Excel existant pour une ligne calculée
   */
  loadExcelCodeForLigne(ligneId: number | undefined): void {
    if (!ligneId) {
      this.excelCodeModal.set('');
      return;
    }
    const mapping = this.excelMappings()[ligneId];
    this.excelCodeModal.set(mapping?.variable ?? '');
  }

  /**
   * Sauvegarder le code Excel pour une ligne calculée
   */
  saveExcelCodeForLigne(ligneCalculeeId: number | undefined): void {
    if (!ligneCalculeeId) return;
    const code = this.excelCodeModal().trim();
    const societeId = this.societeId();

    if (!code) {
      this.errorMessageModal.set('Veuillez entrer un code Excel (ex: L12C24)');
      return;
    }

    this.formuleLoadingModal.set(true);
    const payload: ExcelLigneCalculee = {
      variable: code,
      ligneCalculeeId,
      societeId: societeId ?? undefined
    };

    this.excelLigneCalculeeService.create(payload).subscribe({
      next: (result) => {
        this.excelMappings.update(curr => ({
          ...curr,
          [ligneCalculeeId]: result
        }));
        this.errorMessageModal.set('');
      },
      error: (err) => {
        this.errorMessageModal.set('Erreur lors de la sauvegarde du code Excel');
        console.error(err);
      },
      complete: () => this.formuleLoadingModal.set(false)
    });
  }

  /**
   * Récupérer le code Excel d'une ligne calculée
   */
  getExcelCodeForLigne(ligneId: number | undefined): string {
    if (!ligneId) return '';
    return this.excelMappings()[ligneId]?.variable ?? '';
  }

  /**
   * Mettre à jour le code Excel en édition
   */
  onExcelCodeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.excelCodeModal.set(input.value);
  }

  toggleLigneSelection(ligne: LigneFinanciere): void {
    const ligneId = ligne.id; if (!ligneId) return;
    const selected = this.selectedLignesWithOp();
    const idx = selected.findIndex(s => s.ligneId === ligneId && s.type === 'financiere');
    this.selectedLignesWithOp.set(idx > -1 ? selected.filter((_, i) => i !== idx) : [...selected, { ligneId, ligneName: ligne.nom ?? 'Ligne', operator: '+', type: 'financiere' }]);
    this.calculatePreviewModal();
  }

  toggleLigneCalculeeSelection(ligne: LigneCalculee): void {
    const ligneId = ligne.id; if (!ligneId) return;
    const selected = this.selectedLignesWithOp();
    const idx = selected.findIndex(s => s.ligneId === ligneId && s.type === 'calculee');
    this.selectedLignesWithOp.set(idx > -1 ? selected.filter((_, i) => i !== idx) : [...selected, { ligneId, ligneName: ligne.nom ?? 'Ligne', operator: '+', type: 'calculee' }]);
    this.calculatePreviewModal();
  }

  setOperatorForLigne(ligneId: number, operator: string, type: 'financiere' | 'calculee' = 'financiere'): void {
    this.selectedLignesWithOp.set(this.selectedLignesWithOp().map(s => s.ligneId === ligneId && s.type === type ? { ...s, operator } : s));
    this.calculatePreviewModal();
  }

  onOperatorChange(ligneId: number, event: Event, type: 'financiere' | 'calculee' = 'financiere'): void { this.setOperatorForLigne(ligneId, (event.target as HTMLSelectElement).value, type); }
  isLigneSelected(ligneId: number | undefined): boolean { return !!ligneId && this.selectedLignesWithOp().some(s => s.ligneId === ligneId && s.type === 'financiere'); }
  isLigneCalculeeSelected(ligneId: number | undefined): boolean { return !!ligneId && this.selectedLignesWithOp().some(s => s.ligneId === ligneId && s.type === 'calculee'); }
  getOperatorForLigne(ligneId: number | undefined, type: 'financiere' | 'calculee' = 'financiere'): string { return this.selectedLignesWithOp().find(s => s.ligneId === ligneId && s.type === type)?.operator ?? '+'; }

  buildExpression(): string {
    const selected = this.selectedLignesWithOp();
    if (!selected.length) return '';
    return selected
      .map((item, i) => {
        const token = this.getSelectionToken(item);
        return (i === 0 ? '' : `${item.operator} `) + token;
      })
      .join(' ');
  }

  private buildPreviewExpression(): string {
    return this.buildExpression().replace(/%/g, '/100');
  }

  private getLigneMontantById(ligneId: number, type: 'financiere' | 'calculee'): number | null {
    if (type === 'calculee') {
      const ligne = this.lignesCalculees().find(l => l.id === ligneId);
      if (!ligne) return null;
      const montant = Number(ligne.resultat ?? 0);
      return Number.isNaN(montant) ? 0 : montant;
    }

    const ligne = this.lignes().find(l => l.id === ligneId);
    if (!ligne) return null;
    const montant = Number(ligne.montant ?? 0);
    return Number.isNaN(montant) ? 0 : montant;
  }

  private evaluateSelectedLinesValue(): { value: number | null; error?: string } {
    const selected = this.selectedLignesWithOp();
    if (!selected.length) {
      return { value: null };
    }

    const firstAmount = this.getLigneMontantById(selected[0].ligneId, selected[0].type);
    if (firstAmount == null) {
      return { value: null, error: 'Ligne introuvable.' };
    }

    let result = firstAmount;
    for (let i = 1; i < selected.length; i++) {
      const current = selected[i];
      const amount = this.getLigneMontantById(current.ligneId, current.type);
      if (amount == null) {
        return { value: null, error: 'Ligne introuvable.' };
      }

      const op = (current.operator || '+').trim();
      if (op === '+') result += amount;
      else if (op === '-') result -= amount;
      else if (op === '*') result *= amount;
      else if (op === '/') {
        if (amount === 0) return { value: null, error: 'Division par zéro.' };
        result /= amount;
      } else {
        return { value: null, error: 'Opérateur invalide.' };
      }
    }

    return { value: result };
  }

  calculatePreviewModal(): void {
    const expression = this.buildPreviewExpression();
    if (!expression.trim()) {
      this.resultPreviewModal.set(null);
      this.errorMessageModal.set('');
      return;
    }

    const evaluated = this.evaluateSelectedLinesValue();
    if (evaluated.value == null) {
      this.resultPreviewModal.set(null);
      this.errorMessageModal.set(evaluated.error || 'Formule invalide');
      return;
    }

    this.resultPreviewModal.set(evaluated.value);
    this.errorMessageModal.set('');
  }

  private getPreviewValue(expression: string): Observable<number> {
    return new Observable<number>(observer => {
      const evaluated = this.evaluateSelectedLinesValue();
      if (evaluated.value == null) {
        observer.error({ error: { error: evaluated.error || 'Formule invalide' } });
        return;
      }

      observer.next(evaluated.value);
      observer.complete();
    });
  }

  createLigneCalculeeModal(): void {
    if (this.isSociete()) return;
    const nom = this.nomFormuleModal();
    if (!nom.trim()) { this.errorMessageModal.set('Le nom de la ligne est requis'); return; }
    const selected = this.selectedLignesWithOp();
    if (!selected.length) { this.errorMessageModal.set('Sélectionnez au moins une ligne'); return; }
    const expression = this.buildExpression();
    const previewExpression = this.buildPreviewExpression();
    if (!expression.trim()) { this.errorMessageModal.set('Expression vide'); return; }
    this.formuleLoadingModal.set(true);
    this.getPreviewValue(previewExpression).subscribe({
      next: (previewValue) => {
        // ─── FIX: Use global position so new calculated lines are placed correctly ──
        const position = this.getNextGlobalPosition();

        this.ligneCalculeeService.create({
          nom,
          expression,
          position,
          resultat: previewValue,
          dateCreation: new Date().toISOString(),
          societeId: this.societeId() ?? undefined,
          rapportFinancierId: this.rapportId() ?? undefined,
          categorieFinanciereId: this.selectedCategorieIdModal() ?? undefined,
          sousCategorieFinanciereId: this.selectedSousCategorieIdModal() ?? undefined,
          color: this.calculeeColorModal(),
          couleur: this.calculeeColorModal()
        }).subscribe({
          next: (newLigne) => {
            this.errorMessageModal.set('');
            this.lignesCalculees.update(items => [...items, { ...newLigne, resultat: previewValue }].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
            if (newLigne.id != null) {
              this.calculeeResultCache.update(cache => ({ ...cache, [newLigne.id as number]: previewValue }));
            }
            this.closeLigneCalculeeModal();
            // Reload to get fresh server positions and rebuild consistent order
            const rapportId = this.rapportId();
            if (rapportId) this.loadFinanceData(rapportId);
            alert('Ligne calculée créée avec succès');
          },
          error: (err) => { this.errorMessageModal.set(err.error?.error || 'Erreur lors de la création'); this.formuleLoadingModal.set(false); },
          complete: () => this.formuleLoadingModal.set(false)
        });
      },
      error: (err) => { this.errorMessageModal.set(err.error?.error || 'Formule invalide'); this.formuleLoadingModal.set(false); }
    });
  }

  updateLigneCalculeeModal(): void {
    if (this.isSociete()) return;
    const editing = this.editingLigneCalculee();
    if (!editing?.id) return;
    const editingId = editing.id;

    const nom = this.nomFormuleModal();
    if (!nom.trim()) { this.errorMessageModal.set('Le nom de la ligne est requis'); return; }
    const selected = this.selectedLignesWithOp();
    if (!selected.length) { this.errorMessageModal.set('Sélectionnez au moins une ligne'); return; }
    const expression = this.buildExpression();
    const previewExpression = this.buildPreviewExpression();
    if (!expression.trim()) { this.errorMessageModal.set('Expression vide'); return; }

    this.formuleLoadingModal.set(true);

    this.getPreviewValue(previewExpression).subscribe({
      next: (previewValue) => {
        const payload: UpdateLigneCalculeeDto = {
          id: editingId,
          nom,
          expression,
          resultat: previewValue,
          categorieFinanciereId: this.selectedCategorieIdModal() ?? null,
          sousCategorieFinanciereId: this.selectedSousCategorieIdModal() ?? null,
          color: this.calculeeColorModal(),
          couleur: this.calculeeColorModal()
        };

        this.ligneCalculeeService.update(payload).subscribe({
          next: () => {
            this.errorMessageModal.set('');
            this.lignesCalculees.update(items =>
              items.map(l => l.id === editing.id
                ? { ...l, nom, expression, resultat: previewValue, categorieFinanciereId: payload.categorieFinanciereId, sousCategorieFinanciereId: payload.sousCategorieFinanciereId }
                : l
              )
            );
            this.calculeeResultCache.update(cache => ({ ...cache, [editing.id as number]: previewValue }));
            this.closeLigneCalculeeModal();
            alert('Ligne calculée mise à jour avec succès');
          },
          error: (err) => { this.errorMessageModal.set(err.error?.error || 'Erreur lors de la mise à jour'); this.formuleLoadingModal.set(false); },
          complete: () => this.formuleLoadingModal.set(false)
        });
      },
      error: (err) => { this.errorMessageModal.set(err.error?.error || 'Formule invalide'); this.formuleLoadingModal.set(false); }
    });
  }

  deleteLigneCalculee(ligne: LigneCalculee): void {
    if (this.isSociete() || !ligne.id) return;
    const confirmed = confirm(`Supprimer la ligne calculée "${ligne.nom}" ? Cette action est irréversible.`);
    if (!confirmed) return;

    this.ligneCalculeeService.delete(ligne.id).subscribe({
      next: () => {
        this.lignesCalculees.update(items => items.filter(l => l.id !== ligne.id));

        const currentOrder = this.mixedOrder();
        if (currentOrder) {
          const newOrder = currentOrder.filter(o => !(o.type === 'calculee' && o.id === ligne.id));
          this.mixedOrder.set(newOrder);
          this.saveMixedOrderToStorage(newOrder);
        }
      },
      error: (err) => alert('Erreur lors de la suppression : ' + (err.error?.error || 'Erreur inconnue'))
    });
  }

  onNomFormuleModalChange(event: any): void { this.nomFormuleModal.set(event.target.value); }
  onCategorieCalculeeChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value ? Number((event.target as HTMLSelectElement).value) : null;
    this.selectedCategorieIdModal.set(Number.isNaN(v as number) ? null : v);
    this.selectedSousCategorieIdModal.set(null);
  }
  onSousCategorieCalculeeChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value ? Number((event.target as HTMLSelectElement).value) : null;
    this.selectedSousCategorieIdModal.set(Number.isNaN(v as number) ? null : v);
  }

  // ─── Drag & drop GLOBAL ───────────────────────────────────────
  onMixedDrop(event: CdkDragDrop<MixedItem[]>): void {
    if (this.isSociete()) return;
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.mixedItems()];
    const dragged = items[event.previousIndex];
    if (!dragged) return;

    moveItemInArray(items, event.previousIndex, event.currentIndex);

    // Save mixed order signal
    const mixedOrderSave = items
      .filter(item => item.data.id != null)
      .map(item => ({ type: item.type, id: item.data.id as number }));
    this.mixedOrder.set(mixedOrderSave);
    this.saveMixedOrderToStorage(mixedOrderSave);

    // ─── FIX: Assign GLOBALLY UNIQUE positions across both categories and
    // calculated lines so all users see the same order on next page load.
    // Previously, categories and calculated lines had separate position counters
    // (0,1,2 for cats AND 0,1,2 for calcs), making interleaving impossible.
    // Now they share a single global index.
    const newCategoryOrder: CategorieFinanciere[] = [];
    const newCalculeesOrder: LigneCalculee[] = [];

    items.forEach((item, globalIndex) => {
      if (item.type === 'categorie') {
        newCategoryOrder.push({ ...item.data, position: globalIndex });
      } else {
        newCalculeesOrder.push({ ...item.data, position: globalIndex });
      }
    });

    this.categories.set(newCategoryOrder);
    this.lignesCalculees.set(newCalculeesOrder);
    this.saveCategoriesOrder(newCategoryOrder);
    this.saveLignesCalculeesOrder(newCalculeesOrder);
  }

  onSousDrop(event: CdkDragDrop<SousCategorieFinanciere[]>, categorieId: number | undefined): void {
    if (this.isSociete()) return;
    if (!categorieId || event.previousIndex === event.currentIndex) return;
    const items = [...this.sousFor(categorieId)];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    const reordered = items.map((item, index) => ({ ...item, position: index }));
    const reorderedById = new Map<number, SousCategorieFinanciere>(
      reordered.flatMap(item => (item.id != null ? [[item.id, item as SousCategorieFinanciere]] : []))
    );

    this.sousCategories.update(all =>
      all.map(sc => {
        if (sc.id == null) return sc;
        return reorderedById.get(sc.id) ?? sc;
      })
    );

    this.saveSousCategoriesOrder(reordered);
  }

  onLignesDrop(event: CdkDragDrop<LigneFinanciere[]>, sousCategorieId: number | undefined): void {
    if (this.isSociete()) return;
    if (!sousCategorieId || event.previousIndex === event.currentIndex) return;
    const items = [...this.lignesFor(sousCategorieId)];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    const reordered = items.map((item, index) => ({ ...item, position: index }));
    const reorderedById = new Map<number, LigneFinanciere>(
      reordered.flatMap(item => (item.id != null ? [[item.id, item as LigneFinanciere]] : []))
    );

    this.lignes.update(all =>
      all.map(ligne => {
        if (ligne.id == null) return ligne;
        return reorderedById.get(ligne.id) ?? ligne;
      })
    );

    this.saveLignesOrder(reordered);
  }

  onRowDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onSousRowDragStart(sousId: number | undefined): void {
    if (this.isSociete() || !sousId) return;
    this.draggingSousId = sousId;
  }

  onSousRowDrop(targetSousId: number | undefined, categorieId: number | undefined): void {
    if (this.isSociete() || !targetSousId || !categorieId || this.draggingSousId == null) return;

    const sourceSousId = this.draggingSousId;
    this.draggingSousId = null;
    if (sourceSousId === targetSousId) return;

    const items = [...this.sousFor(categorieId)];
    const from = items.findIndex(item => item.id === sourceSousId);
    const to = items.findIndex(item => item.id === targetSousId);
    if (from === -1 || to === -1) return;

    moveItemInArray(items, from, to);
    const reordered = items.map((item, index) => ({ ...item, position: index }));
    const reorderedById = new Map<number, SousCategorieFinanciere>(
      reordered.flatMap(item => (item.id != null ? [[item.id, item as SousCategorieFinanciere]] : []))
    );

    this.sousCategories.update(all =>
      all.map(sc => {
        if (sc.id == null) return sc;
        return reorderedById.get(sc.id) ?? sc;
      })
    );

    this.saveSousCategoriesOrder(reordered);
  }

  onLigneRowDragStart(ligneId: number | undefined): void {
    if (this.isSociete() || !ligneId) return;
    this.draggingLigneId = ligneId;
  }

  onLigneRowDrop(targetLigneId: number | undefined, sousCategorieId: number | undefined): void {
    if (this.isSociete() || !targetLigneId || !sousCategorieId || this.draggingLigneId == null) return;

    const sourceLigneId = this.draggingLigneId;
    this.draggingLigneId = null;
    if (sourceLigneId === targetLigneId) return;

    const items = [...this.lignesFor(sousCategorieId)];
    const from = items.findIndex(item => item.id === sourceLigneId);
    const to = items.findIndex(item => item.id === targetLigneId);
    if (from === -1 || to === -1) return;

    moveItemInArray(items, from, to);
    const reordered = items.map((item, index) => ({ ...item, position: index }));
    const reorderedById = new Map<number, LigneFinanciere>(
      reordered.flatMap(item => (item.id != null ? [[item.id, item as LigneFinanciere]] : []))
    );

    this.lignes.update(all =>
      all.map(ligne => {
        if (ligne.id == null) return ligne;
        return reorderedById.get(ligne.id) ?? ligne;
      })
    );

    this.saveLignesOrder(reordered);
  }

  private saveCategoriesOrder(items: CategorieFinanciere[]): void {
    const updates = items
      .filter((item): item is CategorieFinanciere & { id: number } => item.id != null)
      .map((item, index) => this.categorieService.update(item.id, { ...item, position: item.position ?? index }));

    if (!updates.length) return;

    forkJoin(updates).subscribe({
      error: (err) => alert('Erreur lors de la sauvegarde de l\'ordre des catégories: ' + (err.error?.error || ''))
    });
  }

  private saveSousCategoriesOrder(items: SousCategorieFinanciere[]): void {
    const updates = items
      .filter((item): item is SousCategorieFinanciere & { id: number } => item.id != null)
      .map((item, index) => this.sousCategorieService.update(item.id, { ...item, position: index }));

    if (!updates.length) return;

    forkJoin(updates).subscribe({
      error: (err) => alert('Erreur lors de la sauvegarde de l\'ordre des sous-catégories: ' + (err.error?.error || ''))
    });
  }

  private saveLignesOrder(items: LigneFinanciere[]): void {
    const updates = items
      .filter((item): item is LigneFinanciere & { id: number } => item.id != null)
      .map((item, index) => this.ligneService.update(item.id, { ...item, position: index }));

    if (!updates.length) return;

    forkJoin(updates).subscribe({
      error: (err) => alert('Erreur lors de la sauvegarde de l\'ordre des lignes: ' + (err.error?.error || ''))
    });
  }

  private saveLignesCalculeesOrder(items: LigneCalculee[]): void {
    const updates = items
      .filter((item): item is LigneCalculee & { id: number } => item.id != null)
      .map(item => this.ligneCalculeeService.update({
        ...item,
        id: item.id,
        nom: item.nom ?? '',
        expression: item.expression ?? '',
        resultat: item.resultat ?? 0,
        categorieFinanciereId: item.categorieFinanciereId ?? null,
        sousCategorieFinanciereId: item.sousCategorieFinanciereId ?? null,
        color: this.resolveColor(item),
        couleur: this.resolveColor(item)
      }));

    if (!updates.length) return;

    forkJoin(updates).subscribe({
      error: (err) => alert('Erreur lors de la sauvegarde de l\'ordre: ' + (err.error?.error || ''))
    });
  }

  // ─── Placement modal ──────────────────────────────────────────
  openPlacementModal(ligneId: number): void {
    if (this.isSociete()) return;
    const ligne = this.lignesCalculees().find(l => l.id === ligneId);
    if (!ligne) return;
    this.placementEditingLigneId.set(ligneId);
    this.placementCategorieId.set(ligne.categorieFinanciereId ?? null);
    this.placementSousCategorieId.set(ligne.sousCategorieFinanciereId ?? null);
    this.placementModalOpen.set(true);
  }

  closePlacementModal(): void { this.placementModalOpen.set(false); this.placementEditingLigneId.set(null); this.placementCategorieId.set(null); this.placementSousCategorieId.set(null); }

  onPlacementCategorieChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value ? Number((event.target as HTMLSelectElement).value) : null;
    this.placementCategorieId.set(Number.isNaN(v as number) ? null : v);
    this.placementSousCategorieId.set(null);
  }

  onPlacementSousCategorieChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value ? Number((event.target as HTMLSelectElement).value) : null;
    this.placementSousCategorieId.set(Number.isNaN(v as number) ? null : v);
  }

  savePlacement(): void {
    if (this.isSociete()) return;
    const ligneId = this.placementEditingLigneId(); if (!ligneId) return;
    const ligne = this.lignesCalculees().find(l => l.id === ligneId); if (!ligne) return;
    const ligneCalculeeId = ligne.id;
    if (!ligneCalculeeId) return;
    const payload: UpdateLigneCalculeeDto = { id: ligneCalculeeId, nom: ligne.nom, expression: ligne.expression, categorieFinanciereId: this.placementCategorieId(), sousCategorieFinanciereId: this.placementSousCategorieId() };
    this.ligneCalculeeService.update(payload).subscribe({
      next: () => { const r = this.rapportId(); if (r) this.loadFinanceData(r); },
      complete: () => this.closePlacementModal()
    });
  }

  getPlacementLabel(ligneId: number): string {
    const ligne = this.lignesCalculees().find(l => l.id === ligneId);
    if (!ligne?.categorieFinanciereId) return 'Non placée';
    const cat = this.categories().find(c => c.id === ligne.categorieFinanciereId);
    if (!cat) return 'Catégorie inconnue';
    if (ligne.sousCategorieFinanciereId) {
      const sous = this.sousCategories().find(s => s.id === ligne.sousCategorieFinanciereId);
      return `${cat.nom ?? ''} → ${sous?.nom ?? 'Sous-cat. inconnue'}`;
    }
    return cat.nom ?? 'Catégorie inconnue';
  }

  getLigneCalculeeResult(ligne: LigneCalculee): number | null {
    if (ligne.resultat != null) return ligne.resultat;
    if (ligne.id == null) return null;
    return this.calculeeResultCache()[ligne.id] ?? null;
  }

  // ─── Helpers pour afficher catégories/sous-catégories ──────────
  getCategoryName(id: number | null | undefined): string {
    if (!id) return '';
    const cat = this.categories().find(c => c.id === id);
    return cat?.nom ?? '';
  }

  getSousCategoryName(id: number | null | undefined): string {
    if (!id) return '';
    const sous = this.sousCategories().find(s => s.id === id);
    return sous?.nom ?? '';
  }

  // Grouper les lignes par catégorie/sous-catégorie pour le modal
  readonly lignesGroupedByCategory = computed(() => {
    const allLignes = this.lignes();
    const categories = this.categories();

    return categories.map(cat => ({
      category: cat,
      subCategories: this.sousFor(cat.id).map(sous => ({
        subCategory: sous,
        lignes: this.lignesFor(sous.id)
      }))
    })).filter(cat => cat.subCategories.some(s => s.lignes.length > 0));
  });

  readonly lignesCalculeesGroupedByCategory = computed(() => {
    const categories = this.categories();
    const calculees = this.lignesCalculees();

    return categories.map(cat => ({
      category: cat,
      calculees: calculees.filter(ligne => ligne.categorieFinanciereId === cat.id && !ligne.sousCategorieFinanciereId),
      subCategories: this.sousFor(cat.id).map(sous => ({
        subCategory: sous,
        calculees: calculees.filter(ligne => ligne.sousCategorieFinanciereId === sous.id)
      }))
    })).filter(cat => cat.calculees.length > 0 || cat.subCategories.some(s => s.calculees.length > 0));
  });

  readonly lignesAndCalculeesGrouped = computed(() => {
    const categories = this.categories();
    const calculees = this.lignesCalculees();

    return categories.map(cat => ({
      category: cat,
      calculees: calculees.filter(ligne => ligne.categorieFinanciereId === cat.id && !ligne.sousCategorieFinanciereId),
      subCategories: this.sousFor(cat.id).map(sous => ({
        subCategory: sous,
        lignes: this.lignesFor(sous.id),
        calculees: calculees.filter(ligne => ligne.sousCategorieFinanciereId === sous.id)
      }))
    })).filter(cat => cat.calculees.length > 0 || cat.subCategories.some(s => s.lignes.length > 0 || s.calculees.length > 0));
  });
}