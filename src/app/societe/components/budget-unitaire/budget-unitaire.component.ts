import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RapportFinancierService } from '../../../admin/services/rapport-financier.service';
import { RapportFinancier, TypeRapport } from '../../../admin/services/rapport-financier.model';
import { SocieteService } from '../../../admin/services/societe.service';
import { CategorieFinanciereService } from '../../../admin/services/categorie-financiere.service';
import { CategorieFinanciere } from '../../../admin/services/categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../../admin/services/sous-categorie-financiere.service';
import { SousCategorieFinanciere } from '../../../admin/services/sous-categorie-financiere.model';
import { LigneFinanciereService } from '../../../admin/services/ligne-financiere.service';
import { LigneFinanciere } from '../../../admin/services/ligne-financiere.model';
import { ExcelVariableService } from '../../../admin/services/excel-variable.service';
import { ExcelVariable } from '../../../admin/services/excel-variable.model';
import { LigneCalculeeService, UpdateLigneCalculeeDto } from '../../../admin/services/ligne-calculee.service';
import { LigneCalculee } from '../../../admin/services/ligne-calculee.model';
import { ExcelLigneCalculeeService } from '../../../admin/services/excel-ligne-calculee.service';
import { ExcelLigneCalculee } from '../../../admin/services/excel-ligne-calculee.model';
import { forkJoin, Observable, catchError, finalize, of } from 'rxjs';
import * as XLSX from 'xlsx';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface UploadState {
  uploading?: boolean;
  message?: string;
  error?: string;
}

interface ImportDiagnostics {
  excelLabels: string[];
  lineLabels: string[];
  lineNames: string[];
  matched: string[];
  unmatchedExcel: string[];
  unmatchedLines: string[];
}

export interface ComparisonRow {
  nom: string;
  variable: string;
  excelValue: number | null;   // value read from Excel cell
  newResultat: number | null;  // value saved in DB (= excelValue if matched)
  oldResultat: number | null;  // value before import
  matched: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-budget-unitaire',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './budget-unitaire.component.html',
  styleUrls: ['./budget-unitaire.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetUnitaireComponent implements OnInit {

  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly route                     = inject(ActivatedRoute);
  private readonly router                    = inject(Router);
  private readonly rapportService            = inject(RapportFinancierService);
  private readonly societeService            = inject(SocieteService);
  private readonly categorieService          = inject(CategorieFinanciereService);
  private readonly sousCategorieService      = inject(SousCategorieFinanciereService);
  private readonly ligneService              = inject(LigneFinanciereService);
  private readonly excelVariableService      = inject(ExcelVariableService);
  private readonly ligneCalculeeService      = inject(LigneCalculeeService);
  private readonly excelLigneCalculeeService = inject(ExcelLigneCalculeeService);

  // ── Signals ───────────────────────────────────────────────────────────────
  readonly societeId         = signal<number | null>(null);
  readonly societeName       = signal<string>('Société');
  readonly rapports          = signal<RapportFinancier[]>([]);
  readonly loading           = signal(false);
  readonly selectedFiles     = signal<Record<number, File | null>>({});
  readonly uploadState       = signal<Record<number, UploadState | undefined>>({});
  readonly diagnostics       = signal<Record<number, ImportDiagnostics | undefined>>({});
  readonly comparisonResults = signal<Record<number, ComparisonRow[]>>({});
  readonly showComparison    = signal<Record<number, boolean>>({});

  readonly typeLabels: Record<TypeRapport, string> = {
    0: 'REEL', 1: 'PREVISIONNEL', 2: 'CR'
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id') ?? sessionStorage.getItem('societeId'));
    if (!id || Number.isNaN(id)) { this.router.navigate(['/societe/dashboard']); return; }
    this.societeId.set(id);
    this.loadSociete(id);
    this.loadRapports(id);
    this.normalizeExcelVariableCodes();
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next:  (s) => this.societeName.set(s?.nom ?? 'Société'),
      error: ()       => this.societeName.set('Société')
    });
  }

  private loadRapports(id: number): void {
    this.loading.set(true);
    this.rapportService.getBySocieteId(id).pipe(
      catchError((error) => {
        console.error('[BudgetUnitaire] getBySocieteId failed, showing empty reports list.', error);
        this.errorStateMessage('Impossible de charger les rapports pour cette société.');
        return of([] as RapportFinancier[]);
      }),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (data) => this.rapports.set(data ?? [])
    });
  }

  private errorStateMessage(message: string): void {
    // keep a small non-blocking message if the template wants to show it later
    console.warn(message);
  }

  // ── File selection ────────────────────────────────────────────────────────
  onFileSelected(rapportId: number | undefined, event: Event): void {
    if (!rapportId) return;
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFiles.update(c => ({ ...c, [rapportId]: file }));
    this.showComparison.update(s    => ({ ...s, [rapportId]: false }));
    this.comparisonResults.update(s => ({ ...s, [rapportId]: [] }));
  }

  // ── Import entry point ────────────────────────────────────────────────────
  importExcel(rapportId: number | undefined): void {
    const file = rapportId ? this.selectedFiles()[rapportId] : null;
    if (!rapportId || !file) return;
    this.updateUploadState(rapportId, { uploading: true, message: undefined, error: undefined });

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result as ArrayBuffer, { type: 'array' });
        // Run both steps; each manages its own loading state
        this.applyValuesFromExcelVariables(rapportId, workbook);
        this.updateAndCompareLignesCalculees(rapportId, workbook);
      } catch {
        this.updateUploadState(rapportId, { uploading: false, error: 'Lecture du fichier impossible.' });
      }
    };
    reader.onerror = () =>
      this.updateUploadState(rapportId, { uploading: false, error: 'Lecture du fichier impossible.' });
    reader.readAsArrayBuffer(file);
  }

  // ── STEP 2: update LigneCalculee.resultat in DB via nom-based matching ────
  //
  // WHY NOM-MATCHING (not ID-matching):
  // ExcelLigneCalculee rows are created once for a "template" société
  // (e.g. ligneCalculeeId=1074 from rapport 12).  When a new rapport is
  // created (e.g. rapport 50), its LignesCalculées get NEW ids (476-491)
  // that will NEVER match the stored ligneCalculeeId values.
  //
  // The stable link is the NAME: "Chiffre d'affaires Local" exists in both
  // the ExcelLigneCalculee.ligneCalculee.nom AND the target rapport's lignes.
  //
  // Algorithm:
  //  1. Load all LignesCalculées for this rapport  (target)
  //  2. Load all ExcelLigneCalculées for this société
  //  3. Load ALL LignesCalculées (all rapports) to resolve names of the
  //     ExcelLigneCalculée reference lignes
  //  4. Build Map<normalisedNom, variable> from ExcelLigneCalculées
  //  5. For each target ligne: look up its nom → get variable → look up
  //     Excel cell value → PUT resultat in DB
  //  6. Show comparison alert
  // ─────────────────────────────────────────────────────────────────────────
  private updateAndCompareLignesCalculees(rapportId: number, workbook: XLSX.WorkBook): void {
    const societeId = this.societeId();
    if (!societeId) return;

    const cellMap = this.buildCellValueMapFromWorkbook(workbook);

    forkJoin({
      allLignesCalc:        this.ligneCalculeeService.getAll(),
      excelLignesCalculees: this.excelLigneCalculeeService.getAll()
    }).subscribe({
      next: ({ allLignesCalc, excelLignesCalculees }) => {

        // 1. Target lignes (this rapport only)
        const lignesForRapport: LigneCalculee[] = (allLignesCalc ?? []).filter(
          (lc: LigneCalculee) => lc.rapportFinancierId === rapportId
        );
        if (!lignesForRapport.length) return;

        // 2. Index ALL lignes by id (needed to resolve ExcelLigneCalculee reference)
        const allLignesById = new Map<number, LigneCalculee>();
        for (const lc of allLignesCalc ?? []) {
          if (lc.id != null) allLignesById.set(lc.id, lc);
        }

        // 3. Build Map<normalised_nom → variable>  from ExcelLigneCalculée
        //    We resolve the nom via the referenced ligneCalculeeId, which
        //    points to any rapport (the "template" rapport).
        //    If the ExcelLigneCalculee carries a nested ligneCalculee object
        //    we use its nom directly; otherwise we resolve via allLignesById.
        const nomToVariable = new Map<string, string>();
        for (const elc of excelLignesCalculees ?? []) {
          if (elc.societeId !== societeId) continue;
          const variable = elc.variable?.trim();
          if (!variable) continue;

          // Try inline navigation property first, then resolve by id
          const refNom: string =
            (elc as ExcelLigneCalculee & { ligneCalculee?: { nom?: string | null } }).ligneCalculee?.nom
            ?? allLignesById.get(elc.ligneCalculeeId)?.nom
            ?? '';

          if (refNom) {
            nomToVariable.set(this.normalizeLabel(refNom), variable);
          }
        }

        // 4. Build update calls + comparison rows
        const updates: Observable<void>[] = [];
        const rows: ComparisonRow[] = [];

        for (const lc of lignesForRapport) {
          const normNom    = this.normalizeLabel(lc.nom ?? '');
          const variable   = nomToVariable.get(normNom) ?? '';
          const excelValue = variable ? (cellMap.get(variable) ?? null) : null;
          const oldResultat = lc.resultat ?? null;

          if (excelValue !== null && lc.id != null) {
            const dto: UpdateLigneCalculeeDto = {
              id:         lc.id,
              nom:        lc.nom,
              expression: lc.expression,
              position:   lc.position,   // preserve existing position
              resultat:   excelValue,
              categorieFinanciereId:     lc.categorieFinanciereId ?? null,
              sousCategorieFinanciereId:  lc.sousCategorieFinanciereId ?? null
            };
            updates.push(this.ligneCalculeeService.update(dto));
          }

          // ✅ = Excel value exists AND matches the old DB resultat
          // ❌ = Excel value missing, OR exists but differs from old DB value
          const valuesMatch =
            excelValue !== null &&
            oldResultat !== null &&
            Math.abs(excelValue - oldResultat) < 0.0001; // float-safe comparison

          rows.push({
            nom:        lc.nom,
            variable,
            excelValue,
            newResultat:  excelValue ?? oldResultat,
            oldResultat,
            matched:    valuesMatch
          });
        }

        const openAlert = () => {
          rows.sort((a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0));
          this.comparisonResults.update(s => ({ ...s, [rapportId]: rows }));
          this.showComparison.update(s    => ({ ...s, [rapportId]: true }));
        };

        if (!updates.length) { openAlert(); return; }

        forkJoin(updates).subscribe({
          next:  () => openAlert(),
          error: () => this.updateUploadState(rapportId, {
            error: 'Mise à jour des résultats calculés impossible.'
          })
        });
      },
      error: () => console.warn('Could not load ExcelLigneCalculee data.')
    });
  }

  // ── STEP 1: patch LigneFinanciere.montant (existing logic, unchanged) ─────
  private applyValuesFromExcelVariables(rapportId: number, workbook: XLSX.WorkBook): void {
    const societeId = this.societeId();
    if (!societeId) {
      this.updateUploadState(rapportId, { uploading: false, error: 'Société inconnue.' });
      return;
    }
    const cellMap = this.buildCellValueMapFromWorkbook(workbook);

    forkJoin({
      vars:   this.excelVariableService.getAll(),
      lignes: this.ligneService.getAll(),
      sous:   this.sousCategorieService.getAll(),
      cats:   this.categorieService.getAll()
    }).subscribe({
      next: ({ vars, lignes, sous, cats }) => {
        const allLignes = lignes ?? [], allSous = sous ?? [], allCats = cats ?? [];

        const lignesById = new Map<number, LigneFinanciere>();
        for (const l of allLignes) { if (l.id != null) lignesById.set(l.id, l); }
        const sousById = new Map<number, SousCategorieFinanciere>();
        for (const sc of allSous) { if (sc.id != null) sousById.set(sc.id, sc); }
        const catsById = new Map<number, CategorieFinanciere>();
        for (const c of allCats) { if (c.id != null) catsById.set(c.id, c); }

        const targetCats    = allCats.filter(c  => c.rapportFinancierId === rapportId && c.id != null);
        const targetCatIds  = new Set(targetCats.map(c  => c.id as number));
        const targetSous    = allSous.filter(sc => targetCatIds.has(sc.categorieFinanciereId) && sc.id != null);
        const targetSousIds = new Set(targetSous.map(sc => sc.id as number));
        const targetLignes  = allLignes.filter(l => l.id != null && targetSousIds.has(l.sousCategorieFinanciereId));

        const targetIndex = new Map<string, LigneFinanciere>();
        for (const l of targetLignes) {
          const sc  = sousById.get(l.sousCategorieFinanciereId);
          const cat = sc ? catsById.get(sc.categorieFinanciereId) : undefined;
          targetIndex.set([
            this.normalizeLabel(cat?.nom  ?? ''),
            this.normalizeLabel(sc?.nom   ?? ''),
            this.normalizeLabel(l.nom     ?? '')
          ].join('||'), l);
        }

        const updates: Observable<unknown>[] = [];
        const matchedCodes: string[] = [];

        for (const v of vars ?? []) {
          if (v.societeId !== societeId) continue;
          const ligneRef = lignesById.get(v.ligneFinanciereId);
          if (!ligneRef) continue;
          const sousRef = sousById.get(ligneRef.sousCategorieFinanciereId);
          if (!sousRef) continue;
          const catRef  = catsById.get(sousRef.categorieFinanciereId);
          if (!catRef) continue;

          const targetLigne = targetIndex.get([
            this.normalizeLabel(catRef.nom   ?? ''),
            this.normalizeLabel(sousRef.nom  ?? ''),
            this.normalizeLabel(ligneRef.nom ?? '')
          ].join('||'));
          if (!targetLigne || targetLigne.id == null) continue;

          const cellCode = this.extractCellCode(v.code ?? null);
          if (!cellCode) continue;
          const value = cellMap.get(cellCode);
          if (value === undefined) continue;

          matchedCodes.push(cellCode);
          updates.push(this.ligneService.patchMontant(targetLigne.id, value));
        }

        this.updateDiagnostics(rapportId, {
          excelLabels:    Array.from(cellMap.keys()),
          lineLabels:     [],
          lineNames:      [],
          matched:        matchedCodes,
          unmatchedExcel: [],
          unmatchedLines: []
        });

        if (!updates.length) {
          this.updateUploadState(rapportId, {
            uploading: false,
            message: 'Aucune correspondance trouvée via ExcelVariables.'
          });
          return;
        }

        forkJoin(updates).subscribe({
          next:     () => this.updateUploadState(rapportId, {
            message: `Montants mis à jour (${matchedCodes.length} ligne(s)).`
          }),
          error:    () => this.updateUploadState(rapportId, { error: 'Mise à jour impossible.' }),
          complete: () => this.updateUploadState(rapportId, { uploading: false })
        });
      },
      error: () => this.updateUploadState(rapportId, {
        uploading: false, error: 'Lecture des données impossible.'
      })
    });
  }

  // ── Excel helpers ─────────────────────────────────────────────────────────
  private buildCellValueMapFromWorkbook(workbook: XLSX.WorkBook): Map<string, number> {
    const map   = new Map<string, number>();
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return map;
    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true }) as any[][];
    matrix.forEach((row: any[], ri: number) => {
      const r = ri + 1;
      row.forEach((cell: any, ci: number) => {
        const c = ci + 1, val = this.toNumber(cell);
        if (val === null) return;
        map.set(`L${r}C${c}`, val);
        if (!map.has(`L${r}`)) map.set(`L${r}`, val);
      });
    });
    return map;
  }

  private toNumber(cell: unknown): number | null {
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'string') {
      const v = Number(cell.replace(/\s+/g, '').replace(',', '.'));
      return Number.isNaN(v) ? null : v;
    }
    return null;
  }

  private extractCellCode(composite: string | null | undefined): string | null {
    if (!composite) return null;
    const idx = composite.indexOf('E:');
    return idx >= 0 ? composite.substring(idx + 2) : composite;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  toggleComparison(rapportId: number): void {
    this.showComparison.update(s => ({ ...s, [rapportId]: !s[rapportId] }));
  }
  closeComparison(rapportId: number): void {
    this.showComparison.update(s => ({ ...s, [rapportId]: false }));
  }
  countMatched(rapportId: number): number {
    return (this.comparisonResults()[rapportId] ?? []).filter(r => r.matched).length;
  }
  countChanged(rapportId: number): number {
    return (this.comparisonResults()[rapportId] ?? []).filter(r => !r.matched && r.excelValue !== null).length;
  }
  countNoVariable(rapportId: number): number {
    return (this.comparisonResults()[rapportId] ?? []).filter(r => r.excelValue === null).length;
  }
  countTotal(rapportId: number): number {
    return (this.comparisonResults()[rapportId] ?? []).length;
  }
  formatNumber(val: number | null): string {
    if (val === null) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goToRapport(rapportId: number | undefined): void {
    const sid = this.societeId();
    if (!rapportId) return;
    this.router.navigate(['/societe', 'rapport-tableau', rapportId]);
  }
  goToRapportCr(rapportId: number | undefined): void {
    if (!rapportId) return;
    this.router.navigate(['/societe', 'rapport-cr', rapportId]);
  }
  goToRapportCalcul(rapportId: number | undefined): void {
    if (!rapportId) return;
    // store rapportId so RapportCalculComponent (which may read from session) can pick it up
    try { sessionStorage.setItem('rapportId', String(rapportId)); } catch {}
    this.router.navigate(['/societe', 'rapport-calcul']);
  }
  goToCles(): void {
    this.router.navigate(['/societe', 'cles-de-repartition']);
  }

  // ── State helpers ─────────────────────────────────────────────────────────
  private updateUploadState(rapportId: number, patch: UploadState): void {
    this.uploadState.update(c => ({
      ...c, [rapportId]: { ...(c[rapportId] ?? {}), ...patch }
    }));
  }
  private updateDiagnostics(rapportId: number, data: ImportDiagnostics | undefined): void {
    this.diagnostics.update(c => ({ ...c, [rapportId]: data }));
  }

  // ── ExcelVariable normalization (existing, unchanged) ─────────────────────
  private normalizeExcelVariableCodes(): void {
    const societeId = this.societeId();
    if (!societeId) return;

    forkJoin({
      vars:   this.excelVariableService.getAll(),
      lignes: this.ligneService.getAll(),
      sous:   this.sousCategorieService.getAll(),
      cats:   this.categorieService.getAll()
    }).subscribe({
      next: ({ vars, lignes, sous, cats }) => {
        const lignesById = new Map<number, LigneFinanciere>();
        for (const l of lignes ?? []) { if (l.id != null) lignesById.set(l.id, l); }
        const sousById = new Map<number, SousCategorieFinanciere>();
        for (const sc of sous ?? []) { if (sc.id != null) sousById.set(sc.id, sc); }
        const catsById = new Map<number, CategorieFinanciere>();
        for (const c of cats ?? []) { if (c.id != null) catsById.set(c.id, c); }

        const updates: Observable<unknown>[] = [];
        for (const v of vars ?? []) {
          if (!v.id || !v.code || v.societeId !== societeId) continue;
          if (v.code.startsWith('C') && v.code.includes('E:')) continue;
          const ligne   = lignesById.get(v.ligneFinanciereId);
          if (!ligne?.sousCategorieFinanciereId) continue;
          const sousCat = sousById.get(ligne.sousCategorieFinanciereId);
          if (!sousCat) continue;
          const cat     = catsById.get(sousCat.categorieFinanciereId);
          if (!cat?.id || !sousCat.id) continue;

          updates.push(this.excelVariableService.update(v.id, {
            id: v.id,
            code: `C${cat.id}S${sousCat.id}L${v.ligneFinanciereId}E:${v.code}`,
            ligneFinanciereId: v.ligneFinanciereId,
            societeId: v.societeId ?? societeId
          }));
        }
        if (updates.length) {
          forkJoin(updates).subscribe({
            next:  () => console.log('ExcelVariable normalization completed'),
            error: (e) => console.error('ExcelVariable normalization failed', e)
          });
        }
      }
    });
  }

  // ── Label normalization ───────────────────────────────────────────────────
  private normalizeLabel(label: string): string {
    return label
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00a0/g, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── TrackBy ───────────────────────────────────────────────────────────────
  trackByRapport(_i: number, r: RapportFinancier): number | undefined { return r.id; }
  trackByRow    (_i: number, row: ComparisonRow): string { return row.nom; }
}