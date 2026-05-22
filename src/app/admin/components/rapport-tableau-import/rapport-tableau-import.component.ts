import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { CategorieFinanciere } from '../../services/categorie-financiere.model';
import { CategorieFinanciereService } from '../../services/categorie-financiere.service';
import { ExcelLigneCalculeeService } from '../../services/excel-ligne-calculee.service';
import { ExcelVariable } from '../../services/excel-variable.model';
import { ExcelVariableService } from '../../services/excel-variable.service';
import { LigneCalculee } from '../../services/ligne-calculee.model';
import { LigneCalculeeService } from '../../services/ligne-calculee.service';
import { LigneFinanciere } from '../../services/ligne-financiere.model';
import { LigneFinanciereService } from '../../services/ligne-financiere.service';
import { SousCategorieFinanciere } from '../../services/sous-categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../services/sous-categorie-financiere.service';

export interface ExcelRowView {
  index: number;
  preview: string;
  label: string;
  value: number | null;
  code: string;
}

@Component({
  selector: 'app-rapport-tableau-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rapport-tableau-import.component.html',
  styleUrls: ['./rapport-tableau-import.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RapportTableauImportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categorieService = inject(CategorieFinanciereService);
  private readonly sousService = inject(SousCategorieFinanciereService);
  private readonly ligneService = inject(LigneFinanciereService);
  private readonly ligneCalculeeService = inject(LigneCalculeeService);
  private readonly excelVariableService = inject(ExcelVariableService);
  private readonly excelLigneCalculeeService = inject(ExcelLigneCalculeeService);

  readonly societeId = signal<number | null>(null);
  readonly rapportId = signal<number | null>(null);

  readonly categories = signal<CategorieFinanciere[]>([]);
  readonly sousCategories = signal<SousCategorieFinanciere[]>([]);
  readonly lignes = signal<LigneFinanciere[]>([]);
  readonly lignesCalculees = signal<LigneCalculee[]>([]);

  readonly loading = signal(false);
  readonly applying = signal(false);
  readonly creating = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly sheetNames = signal<string[]>([]);
  readonly activeSheet = signal('');
  readonly headers = signal<string[]>([]);
  readonly data = signal<Record<string, unknown>[]>([]);
  readonly excelRows = signal<ExcelRowView[]>([]);

  readonly selectedRowForLigne = signal<Record<number, number | null>>({});
  readonly selectedRowForCalculee = signal<Record<number, number | null>>({});
  readonly createRowIndex = signal<number | null>(null);
  readonly createCategoryId = signal<number | null>(null);
  readonly createSousCategorieId = signal<number | null>(null);
  readonly createName = signal('');
  readonly createUnite = signal('');
  readonly createColor = signal<string>('#217346');

  private workbook: XLSX.WorkBook | null = null;

  readonly hasExcel = computed(() => this.excelRows().length > 0);

  ngOnInit(): void {
    const societeId = Number(this.route.snapshot.paramMap.get('id'));
    const rapportId = Number(this.route.snapshot.paramMap.get('rapportId'));

    if (!societeId || !rapportId || Number.isNaN(societeId) || Number.isNaN(rapportId)) {
      this.router.navigate(['/admin/societes']);
      return;
    }

    this.societeId.set(societeId);
    this.rapportId.set(rapportId);
    this.loadData(rapportId);
  }

  loadData(rapportId: number): void {
    this.loading.set(true);
    forkJoin([
      this.categorieService.getAll(),
      this.sousService.getAll(),
      this.ligneService.getAll(),
      this.ligneCalculeeService.getAll()
    ]).subscribe({
      next: ([cats, sous, lignes, calculees]) => {
        const filteredCats = (cats ?? []).filter(c => c.rapportFinancierId === rapportId);
        this.categories.set(filteredCats);

        const catIds = new Set(filteredCats.map(c => c.id).filter(Boolean) as number[]);
        const filteredSous = (sous ?? []).filter(s => catIds.has(s.categorieFinanciereId));
        this.sousCategories.set(filteredSous);

        const sousIds = new Set(filteredSous.map(s => s.id).filter(Boolean) as number[]);
        this.lignes.set((lignes ?? []).filter(l => sousIds.has(l.sousCategorieFinanciereId)));
        this.lignesCalculees.set((calculees ?? []).filter(l => l.rapportFinancierId === rapportId));

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossible de charger les données du rapport.');
      }
    });
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string | ArrayBuffer;
      const readType = isCsv ? 'string' : 'array';
      this.workbook = XLSX.read(content, { type: readType, raw: true });
      this.sheetNames.set(this.workbook.SheetNames);
      this.loadSheet(this.workbook.SheetNames[0]);
    };
    if (isCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  onSheetChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    if (this.workbook) {
      this.loadSheet(name);
    }
  }

  private loadSheet(sheetName: string): void {
    if (!this.workbook) return;
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) return;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true
    }) as unknown[][];

    const maxLen = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    const headers = Array.from({ length: maxLen }, (_v, i) => `Col ${i + 1}`);
    this.headers.set(headers);
    this.activeSheet.set(sheetName);

    this.data.set(matrix.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });
      return obj;
    }));

    this.excelRows.set(matrix.map((row, index) => this.buildExcelRow(row, index)));
    this.message.set(null);
    this.error.set(null);
  }

  private buildExcelRow(row: unknown[], index: number): ExcelRowView {
    const previewParts = row
      .slice(0, 3)
      .map((c) => (c == null ? '' : String(c)))
      .filter((v) => v.trim() !== '');
    const preview = previewParts.join(' | ') || `Ligne ${index + 1}`;

    const labelCell = row.find(
      (cell) => typeof cell === 'string' && cell.trim() !== '' && !/^#ref!?$/i.test(cell.trim())
    );
    const label = labelCell ? String(labelCell).trim() : preview;

    const candidate = [...row].reverse().find(
      (cell) =>
        typeof cell === 'number' ||
        (typeof cell === 'string' && cell.trim() !== '' && !/^#ref!?$/i.test(cell.trim()))
    );

    let value: number | null = null;
    let valueColIndex = -1;
    if (typeof candidate === 'number') {
      value = candidate;
    } else if (typeof candidate === 'string') {
      const parsed = Number(candidate.replace(/\s+/g, '').replace(',', '.'));
      if (!Number.isNaN(parsed)) value = parsed;
    }
    if (value !== null) {
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i] === candidate) {
          valueColIndex = i;
          break;
        }
      }
    }

    const code = valueColIndex >= 0 ? `L${index + 1}C${valueColIndex + 1}` : `L${index + 1}`;
    return { index, preview, label, value, code };
  }

  excelRowValueAt(index: number): number | string {
    const row = this.excelRows()[index];
    return row?.value ?? '';
  }

  labelForLigne(ligne: LigneFinanciere): string {
    const sous = this.sousCategories().find(s => s.id === ligne.sousCategorieFinanciereId);
    const cat = sous ? this.categories().find(c => c.id === sous.categorieFinanciereId) : undefined;
    return [cat?.nom, sous?.nom, ligne.nom].filter(Boolean).join(' · ');
  }

  sousForCategory(categorieId: number | null): SousCategorieFinanciere[] {
    if (!categorieId) return [];
    return this.sousCategories().filter(s => s.categorieFinanciereId === categorieId);
  }

  onLigneExcelChange(ligneId: number, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedRowForLigne.update(map => ({ ...map, [ligneId]: val === '' ? null : Number(val) }));
  }

  onCalculeeExcelChange(calculeeId: number, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const rowIndex = val === '' ? null : Number(val);
    this.selectedRowForCalculee.update(map => ({ ...map, [calculeeId]: rowIndex }));

    if (rowIndex != null) {
      const row = this.excelRows()[rowIndex];
      const societeId = this.societeId();
      if (row && societeId) {
        this.excelLigneCalculeeService.create({
          variable: row.code,
          ligneCalculeeId: calculeeId,
          societeId
        }).subscribe();
      }
    }
  }

  excelValueForLigne(ligneId: number): number | string {
    const idx = this.selectedRowForLigne()[ligneId];
    if (idx == null) return '';
    return this.excelRows()[idx]?.value ?? '';
  }

  excelValueForCalculee(calculeeId: number): number | string {
    const idx = this.selectedRowForCalculee()[calculeeId];
    if (idx == null) return '';
    return this.excelRows()[idx]?.value ?? '';
  }

  startCreateFromRow(rowIndex: number): void {
    const row = this.excelRows()[rowIndex];
    if (!row) return;
    this.createRowIndex.set(rowIndex);
    this.createName.set(row.label || row.preview);
    this.createUnite.set('');
    this.createColor.set('#217346');
    this.createCategoryId.set(null);
    this.createSousCategorieId.set(null);
  }

  applySelection(): void {
    const rapportId = this.rapportId();
    const societeId = this.societeId();
    if (!rapportId || !societeId || !this.hasExcel()) {
      this.error.set('Importez un fichier Excel d\'abord.');
      return;
    }

    const rows = this.excelRows();
    const lignes = this.lignes();
    const selected = this.selectedRowForLigne();
    const sousCategories = this.sousCategories();

    const updates: ReturnType<LigneFinanciereService['patchMontant']>[] = [];
    const excelVars: ReturnType<ExcelVariableService['create']>[] = [];

    for (const ligne of lignes) {
      if (!ligne.id) continue;
      const rowIndex = selected[ligne.id];
      if (rowIndex == null) continue;
      const row = rows[rowIndex];
      if (!row) continue;

      const value = row.value ?? 0;
      updates.push(this.ligneService.patchMontant(ligne.id, value));

      const sous = sousCategories.find(s => s.id === ligne.sousCategorieFinanciereId);
      const code = sous?.id && sous.categorieFinanciereId
        ? `C${sous.categorieFinanciereId}S${sous.id}L${ligne.id}E:${row.code}`
        : row.code;
      const payload: ExcelVariable = { code, ligneFinanciereId: ligne.id, societeId };
      excelVars.push(this.excelVariableService.create(payload));
    }

    if (!updates.length) {
      this.message.set('Aucune ligne sélectionnée.');
      return;
    }

    this.applying.set(true);
    this.error.set(null);
    forkJoin([...updates, ...excelVars]).subscribe({
      next: () => {
        this.message.set('Montants mis à jour.');
        this.loadData(rapportId);
      },
      error: () => this.error.set('Mise à jour impossible.'),
      complete: () => this.applying.set(false)
    });
  }

  createLigneFromExcel(): void {
    const rapportId = this.rapportId();
    const createRowIndex = this.createRowIndex();
    const createSousCategorieId = this.createSousCategorieId();
    if (!rapportId || createRowIndex == null || !createSousCategorieId) {
      this.error.set('Choisissez une ligne Excel et une sous-catégorie.');
      return;
    }

    const row = this.excelRows()[createRowIndex];
    if (!row) return;

    this.creating.set(true);
    this.ligneService.create({
      nom: (this.createName().trim() || row.label).trim(),
      unite: this.createUnite().trim(),
      montant: row.value ?? 0,
      mois: 1,
      annee: new Date().getFullYear(),
      sousCategorieFinanciereId: createSousCategorieId,
      color: this.createColor(),
      couleur: this.createColor()
    }).subscribe({
      next: () => {
        this.message.set('Ligne créée.');
        this.createRowIndex.set(null);
        this.loadData(rapportId);
      },
      error: () => this.error.set('Création impossible.'),
      complete: () => this.creating.set(false)
    });
  }

  backToTableau(): void {
    const societeId = this.societeId();
    const rapportId = this.rapportId();
    if (!societeId || !rapportId) return;
    this.router.navigate(['/admin/societes', societeId, 'rapports', rapportId, 'tableau']);
  }
}
