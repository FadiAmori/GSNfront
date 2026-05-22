import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SocieteService } from '../../services/societe.service';
import { ClesDeRepartition, ClesDeRepartitionService } from '../../services/cles-de-repartition.service';
import { CategorieFinanciere } from '../../services/categorie-financiere.model';
import { CategorieFinanciereService } from '../../services/categorie-financiere.service';
import { SousCategorieFinanciere } from '../../services/sous-categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../services/sous-categorie-financiere.service';
import { LigneFinanciere } from '../../services/ligne-financiere.model';
import { LigneFinanciereService } from '../../services/ligne-financiere.service';
import { LigneCalculee } from '../../services/ligne-calculee.model';
import { LigneCalculeeService } from '../../services/ligne-calculee.service';

type FormulaKey = 'saisonaliteCA' | 'saisonalitePoids' | 'clesCoutFixes';

interface FormulaConfig {
  coef: FormulaKey;
  factor: number;
}

type MixedRef = { type: 'categorie' | 'calculee'; id: number; position: number };

type LineFinanciereTyped = LigneFinanciere & { type: 'financiere' };
type LineCalculeeTyped = LigneCalculee & { type: 'calculee' };
type AnyLine = LineFinanciereTyped | LineCalculeeTyped;

interface SubGroup {
  sousCategorie: SousCategorieFinanciere;
  isCategoryLevel: boolean;
  allLines: AnyLine[];
}

interface CategorieBlock {
  kind: 'categorie';
  categorie: CategorieFinanciere;
  subGroups: SubGroup[];
}

interface OrphanBlock {
  kind: 'calculee';
  ligne: LineCalculeeTyped;
}

type TopLevelItem = CategorieBlock | OrphanBlock;

@Component({
  selector: 'app-rapport-calcul',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  templateUrl: './rapport-calcul.component.html',
  styleUrls: ['./rapport-calcul.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RapportCalculComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly societeService = inject(SocieteService);
  private readonly clesService = inject(ClesDeRepartitionService);
  private readonly categorieService = inject(CategorieFinanciereService);
  private readonly sousCategorieService = inject(SousCategorieFinanciereService);
  private readonly ligneService = inject(LigneFinanciereService);
  private readonly ligneCalculeeService = inject(LigneCalculeeService);

  readonly societeId = signal<number | null>(null);
  readonly rapportId = signal<number | null>(null);
  readonly societeName = signal<string>('Societe');
  readonly loading = signal(false);

  readonly months = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
  ];

  readonly clesByMonth = signal<Record<string, ClesDeRepartition>>({});
  readonly categories = signal<CategorieFinanciere[]>([]);
  readonly sousCategories = signal<SousCategorieFinanciere[]>([]);
  readonly lignes = signal<LigneFinanciere[]>([]);
  readonly lignesCalculees = signal<LigneCalculee[]>([]);
  readonly formulas = signal<Record<number, FormulaConfig | undefined>>({});
  readonly calculeeFormulas = signal<Record<number, FormulaConfig | undefined>>({});

  readonly mixedOrder = signal<MixedRef[]>([]);
  readonly isSociete = computed(() => sessionStorage.getItem('userType') === 'societe');
  readonly backLink = computed(() => ['/admin/societes', String(this.societeId() ?? ''), 'rapports']);

  private readonly coefLabels: Record<FormulaKey, string> = {
    saisonaliteCA: 'Saisonalite CA',
    saisonalitePoids: 'Saisonalite poids',
    clesCoutFixes: 'Cles cout fixes'
  };

  readonly topLevel = computed((): TopLevelItem[] => {
    const order = this.mixedOrder();
    const cats = this.categories();
    const sous = this.sousCategories();
    const lignes = this.lignes();
    const lignesCalc = this.lignesCalculees();

    const result: TopLevelItem[] = [];
    const seenCatIds = new Set<number>();
    const seenCalcIds = new Set<number>();

    for (const ref of order) {
      if (ref.type === 'categorie') {
        const cat = cats.find(c => c.id === ref.id);
        if (!cat || cat.id == null) continue;
        seenCatIds.add(cat.id);
        result.push({ kind: 'categorie', categorie: cat, subGroups: this.buildSubGroups(cat, sous, lignes, lignesCalc) });
      } else {
        const lc = lignesCalc.find(l => l.id === ref.id);
        if (!lc || lc.id == null) continue;
        if (lc.categorieFinanciereId || lc.sousCategorieFinanciereId) continue;
        seenCalcIds.add(lc.id);
        result.push({ kind: 'calculee', ligne: { ...lc, type: 'calculee' } });
      }
    }

    cats.forEach(cat => {
      if (cat.id != null && !seenCatIds.has(cat.id)) {
        result.push({ kind: 'categorie', categorie: cat, subGroups: this.buildSubGroups(cat, sous, lignes, lignesCalc) });
      }
    });

    lignesCalc
      .filter(lc => !lc.categorieFinanciereId && !lc.sousCategorieFinanciereId)
      .forEach(lc => {
        if (lc.id != null && !seenCalcIds.has(lc.id)) {
          result.push({ kind: 'calculee', ligne: { ...lc, type: 'calculee' } });
        }
      });

    return result;
  });

  private buildSubGroups(
    cat: CategorieFinanciere,
    sous: SousCategorieFinanciere[],
    lignes: LigneFinanciere[],
    lignesCalc: LigneCalculee[]
  ): SubGroup[] {
    const subCats = sous
      .filter(sc => sc.categorieFinanciereId === cat.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const groups: SubGroup[] = subCats.map(sc => {
      const fin = lignes
        .filter(l => l.sousCategorieFinanciereId === sc.id)
        .map(l => ({ ...l, type: 'financiere' as const }));
      const calc = lignesCalc
        .filter(lc => lc.sousCategorieFinanciereId === sc.id)
        .map(lc => ({ ...lc, type: 'calculee' as const }));
      const allLines: AnyLine[] = [...fin, ...calc].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return { sousCategorie: sc, isCategoryLevel: false, allLines };
    });

    const catLevelCalcs: AnyLine[] = lignesCalc
      .filter(lc => lc.categorieFinanciereId === cat.id && !lc.sousCategorieFinanciereId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(lc => ({ ...lc, type: 'calculee' as const }));

    if (catLevelCalcs.length > 0) {
      groups.push({
        sousCategorie: { id: undefined as any, nom: '', categorieFinanciereId: cat.id! } as SousCategorieFinanciere,
        isCategoryLevel: true,
        allLines: catLevelCalcs
      });
    }

    return groups;
  }

  readonly hasData = computed(() => this.topLevel().length > 0);

  readonly orphanCalculees = computed((): LineCalculeeTyped[] =>
    this.lignesCalculees()
      .filter(lc => !lc.categorieFinanciereId && !lc.sousCategorieFinanciereId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(lc => ({ ...lc, type: 'calculee' as const }))
  );

  ngOnInit(): void {
    const sId = this.route.snapshot.paramMap.get('id');
    const rId = this.route.snapshot.paramMap.get('rapportId');
    const currentSocieteId = sId ? Number(sId) : null;
    const currentRapportId = rId ? Number(rId) : null;

    if (!currentSocieteId || Number.isNaN(currentSocieteId) || !currentRapportId || Number.isNaN(currentRapportId)) {
      this.router.navigate(['/admin/societes']);
      return;
    }

    this.societeId.set(currentSocieteId);
    this.rapportId.set(currentRapportId);
    this.loadSociete(currentSocieteId);
    this.loadData(currentSocieteId, currentRapportId);
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s: any) => this.societeName.set(s?.nom ?? 'Societe'),
      error: () => this.societeName.set('Societe')
    });
  }

  private loadData(societeId: number, rapportId: number): void {
    this.loading.set(true);

    forkJoin([
      this.clesService.getAll(),
      this.categorieService.getAll(),
      this.sousCategorieService.getAll(),
      this.ligneService.getAll(),
      this.ligneCalculeeService.getAll()
    ]).subscribe({
      next: ([cles, categories, sous, lignes, lignesCalc]) => {
        const clesMap: Record<string, ClesDeRepartition> = {};
        (cles ?? [])
          .filter(c => c.societeId === societeId || c.idSociete === societeId)
          .forEach(c => { if (c.mois) clesMap[c.mois] = c; });
        this.clesByMonth.set(clesMap);

        const catFiltered = (categories ?? []).filter(c => c.rapportFinancierId === rapportId);
        const catIds = new Set(catFiltered.map(c => c.id).filter(Boolean) as number[]);
        const sousFiltered = (sous ?? []).filter(sc => catIds.has(sc.categorieFinanciereId));
        const sousIds = new Set(sousFiltered.map(sc => sc.id).filter(Boolean) as number[]);

        const filteredLignes = (lignes ?? []).filter(l => sousIds.has(l.sousCategorieFinanciereId));

        const filteredLignesCalc = (lignesCalc ?? []).filter(lc => {
          if (lc.rapportFinancierId === rapportId) return true;
          if (!lc.rapportFinancierId && lc.categorieFinanciereId && catIds.has(lc.categorieFinanciereId) && !lc.sousCategorieFinanciereId) return true;
          if (!lc.rapportFinancierId && lc.sousCategorieFinanciereId && sousIds.has(lc.sousCategorieFinanciereId)) return true;
          return false;
        });

        this.categories.set(catFiltered);
        this.sousCategories.set(sousFiltered);
        this.lignes.set(filteredLignes);
        this.lignesCalculees.set(filteredLignesCalc);

        const allMixed: MixedRef[] = [
          ...catFiltered
            .filter(c => c.id != null)
            .map(c => ({ type: 'categorie' as const, id: c.id!, position: c.position ?? 0 })),
          ...filteredLignesCalc
            .filter(lc => lc.id != null && !lc.categorieFinanciereId && !lc.sousCategorieFinanciereId)
            .map(lc => ({ type: 'calculee' as const, id: lc.id!, position: lc.position ?? 0 }))
        ];

        this.mixedOrder.set(allMixed.sort((a, b) => a.position - b.position));

        const fInit: Record<number, FormulaConfig | undefined> = {};
        filteredLignes.forEach(l => { if (l.id) fInit[l.id] = { coef: 'saisonaliteCA', factor: 1 }; });
        this.formulas.set(fInit);

        const cInit: Record<number, FormulaConfig | undefined> = {};
        filteredLignesCalc.forEach(lc => { if (lc.id) cInit[lc.id] = { coef: 'saisonaliteCA', factor: 1 }; });
        this.calculeeFormulas.set(cInit);
      },
      error: () => {
        this.clesByMonth.set({});
        this.categories.set([]);
        this.sousCategories.set([]);
        this.lignes.set([]);
        this.lignesCalculees.set([]);
      },
      complete: () => this.loading.set(false)
    });
  }

  updateCoef(id: number | undefined, coef: FormulaKey): void {
    if (this.isSociete() || !id) return;
    const n = { ...this.formulas() };
    n[id] = { ...(n[id] ?? { coef, factor: 1 }), coef };
    this.formulas.set(n);
  }

  updateFactor(id: number | undefined, factor: number): void {
    if (this.isSociete() || !id) return;
    const n = { ...this.formulas() };
    n[id] = { ...(n[id] ?? { coef: 'saisonaliteCA', factor: 1 }), factor };
    this.formulas.set(n);
  }

  coefLabelFor(id: number | undefined): string {
    if (!id) return this.coefLabels.saisonaliteCA;
    return this.coefLabels[this.formulas()[id]?.coef ?? 'saisonaliteCA'];
  }

  updateCalculeeCoef(id: number | undefined, coef: FormulaKey): void {
    if (this.isSociete() || !id) return;
    const n = { ...this.calculeeFormulas() };
    n[id] = { ...(n[id] ?? { coef, factor: 1 }), coef };
    this.calculeeFormulas.set(n);
  }

  updateCalculeeFactor(id: number | undefined, factor: number): void {
    if (this.isSociete() || !id) return;
    const n = { ...this.calculeeFormulas() };
    n[id] = { ...(n[id] ?? { coef: 'saisonaliteCA', factor: 1 }), factor };
    this.calculeeFormulas.set(n);
  }

  calculeeCoefLabelFor(id: number | undefined): string {
    if (!id) return this.coefLabels.saisonaliteCA;
    return this.coefLabels[this.calculeeFormulas()[id]?.coef ?? 'saisonaliteCA'];
  }

  valueFor(line: LigneFinanciere, month: string): number {
    const cle = this.clesByMonth()[month];
    if (!cle) return 0;

    const f = line.id ? this.formulas()[line.id] : undefined;
    const key = f?.coef ?? 'saisonaliteCA';

    const pct = key === 'saisonaliteCA'
      ? (cle.saisonaliteCA ?? 0)
      : key === 'saisonalitePoids'
        ? (cle.saisonalitePoids ?? 0)
        : (cle.clesCoutFixes ?? 0);

    return (line.montant ?? 0) * (f?.factor ?? 1) * (pct / 100);
  }

  valueForItem(item: AnyLine, month: string): number {
    return item.type === 'financiere' ? this.valueFor(item, month) : this.valueForCalculee(item, month);
  }

  totalForItem(item: AnyLine): number {
    return this.months.reduce((sum, month) => sum + this.valueForItem(item, month), 0);
  }

  coefPercentFor(month: string, coefKey: FormulaKey): number {
    const cle = this.clesByMonth()[month];
    if (!cle) return 0;

    return coefKey === 'saisonaliteCA'
      ? (cle.saisonaliteCA ?? 0)
      : coefKey === 'saisonalitePoids'
        ? (cle.saisonalitePoids ?? 0)
        : (cle.clesCoutFixes ?? 0);
  }

  valueForCalculee(ligne: LigneCalculee, month: string): number {
    const monthly = this.evaluateFormulaForMonth(ligne.expression, month);
    const factor = ligne.id ? (this.calculeeFormulas()[ligne.id]?.factor ?? 1) : 1;
    return monthly * factor;
  }

  private evaluateFormulaForMonth(expression: string, month: string): number {
    try {
      let expr = expression ?? '';

      const coded = [...new Set(expr.match(/(c\d+s\d+[a-z0-9]+)/gi) ?? [])];
      for (const token of coded) {
        const val = this.getCodedLineValueForMonth(token, month);
        expr = expr.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), String(val));
      }

      const nums = [...new Set(expr.match(/\b\d+\b/g) ?? [])];
      for (const token of nums) {
        const lineId = Number(token);
        if (this.lignes().find(l => l.id === lineId) || this.lignesCalculees().find(lc => lc.id === lineId)) {
          expr = expr.replace(new RegExp(`\\b${token}\\b`, 'g'), String(this.getLineValueForMonth(lineId, month)));
        }
      }

      return Number(Function(`"use strict"; return (${expr})`)()) || 0;
    } catch {
      return 0;
    }
  }

  private getCodedLineValueForMonth(code: string, month: string): number {
    const target = code.toLowerCase();

    for (const line of this.lignes()) {
      if (line.id && this.buildGeneratedLineCode(line).toLowerCase() === target) {
        return this.valueFor(line, month);
      }
    }

    for (const calc of this.lignesCalculees()) {
      if (calc.id && this.buildGeneratedCalculeeCode(calc).toLowerCase() === target) {
        return this.evaluateFormulaForMonth(calc.expression, month);
      }
    }

    return 0;
  }

  private buildGeneratedLineCode(line: LigneFinanciere): string {
    const sous = this.sousCategories().find(sc => sc.id === line.sousCategorieFinanciereId);
    if (!sous) return '';
    const part = this.norm(line.nom ?? '');
    return part ? `c${sous.categorieFinanciereId}s${sous.id}${part}` : '';
  }

  private buildGeneratedCalculeeCode(ligne: LigneCalculee): string {
    if (!ligne.categorieFinanciereId || !ligne.sousCategorieFinanciereId) return '';
    return `c${ligne.categorieFinanciereId}s${ligne.sousCategorieFinanciereId}${this.norm(ligne.nom ?? '')}`;
  }

  private norm(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private getLineValueForMonth(lineId: number, month: string): number {
    const fin = this.lignes().find(l => l.id === lineId);
    if (fin) return this.valueFor(fin, month);

    const calc = this.lignesCalculees().find(lc => lc.id === lineId);
    if (calc) return this.evaluateFormulaForMonth(calc.expression, month);

    return 0;
  }

  trackByTopLevel(_i: number, item: TopLevelItem): string {
    return item.kind === 'categorie' ? `cat-${item.categorie.id}` : `calc-${item.ligne.id}`;
  }

  trackBySubGroup(_i: number, sg: SubGroup): any {
    return sg.sousCategorie?.id ?? 'cat-level';
  }

  trackByLineItem(_i: number, item: AnyLine): number | undefined {
    return item.id;
  }

  trackByMonth(_i: number, m: string): string {
    return m;
  }

  onCalculeeDropped(event: CdkDragDrop<LineCalculeeTyped[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...event.container.data];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    const payload = items
      .filter(item => item.id != null)
      .map((item, index) => ({ id: item.id, position: index }));

    this.ligneCalculeeService.updateOrder(payload).subscribe({
      next: () => {
        const currentSocieteId = this.societeId();
        const currentRapportId = this.rapportId();
        if (currentSocieteId && currentRapportId) this.loadData(currentSocieteId, currentRapportId);
      }
    });
  }
}
