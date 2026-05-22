import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LineChartComponent, LineChartSeries } from '../line-chart/line-chart.component';
import { SocieteService } from '../../services/societe.service';
import { UserSocieteService } from '../../services/user-societe.service';
import { UserSociete } from '../../services/user-societe.model';
import { ProduitService } from '../../services/produit.service';
import { RapportFinancierService } from '../../services/rapport-financier.service';
import { RapportFinancier, TypeRapport } from '../../services/rapport-financier.model';
import { CategorieFinanciereService } from '../../services/categorie-financiere.service';
import { CategorieFinanciere } from '../../services/categorie-financiere.model';
import { SousCategorieFinanciereService } from '../../services/sous-categorie-financiere.service';
import { SousCategorieFinanciere } from '../../services/sous-categorie-financiere.model';
import { FamilleProduitService } from '../../services/famille-produit.service';
import { TypeClientService } from '../../services/type-client.service';
import { LigneFinanciereService } from '../../services/ligne-financiere.service';
import { LigneFinanciere } from '../../services/ligne-financiere.model';
import { LigneCalculeeService } from '../../services/ligne-calculee.service';
import { LigneCalculee } from '../../services/ligne-calculee.model';
import { CategorieCrService } from '../../services/categorie-cr.service';
import { SousCategorieCrService } from '../../services/sous-categorie-cr.service';
import { CountDash, CountDashService } from '../../services/count-dash.service';
import { CBDash, CBDashService } from '../../services/cb-dash.service';
import { ClesDeRepartition, ClesDeRepartitionService } from '../../services/cles-de-repartition.service';
import { CourbDash, CourbDashService } from '../../services/courb-dash.service';

interface DashboardMetric {
  key: string;
  label: string;
  description: string;
  value: number;
  colorClass: string;
  enabled: boolean;
  customColor?: string | null;
}

type ChartShape = 'circle' | 'bar';
type ChartDimension = 'categorie' | 'sousCategorie' | 'ligne';

interface ChartSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface CustomChartConfig {
  id: number;
  shape: ChartShape;
  dimension: ChartDimension;
  rapportId: number | null;
  // filtre optionnel selon la dimension
  // - dimension = 'categorie'      -> filtre sur une catégorie financière
  // - dimension = 'sousCategorie'  -> filtre sur une catégorie financière (regroupe ses sous-catégories)
  // - dimension = 'ligne'         -> filtre sur une sous‑catégorie financière (regroupe ses lignes)
  filterId: number | null;
  dbId?: number | null; // id de la ligne CBDash
}

interface CourbeConfig {
  id: number;
  categorieId: number | null;
  sousCategorieId: number | null;
  rapport1Id: number | null;
  rapport2Id: number | null;
  dbId?: number | null; // id de la ligne CourbDash
}

@Component({
  selector: 'app-societe-dashboard',
  standalone: true,
  imports: [CommonModule, LineChartComponent],
  templateUrl: './societe-dashboard.component.html',
  styleUrls: ['./societe-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocieteDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly societeService = inject(SocieteService);
  private readonly userSocieteService = inject(UserSocieteService);
  private readonly produitService = inject(ProduitService);
  private readonly rapportService = inject(RapportFinancierService);
  private readonly categorieService = inject(CategorieFinanciereService);
  private readonly sousCategorieService = inject(SousCategorieFinanciereService);
  private readonly familleProduitService = inject(FamilleProduitService);
  private readonly typeClientService = inject(TypeClientService);
  private readonly ligneService = inject(LigneFinanciereService);
  private readonly ligneCalculeeService = inject(LigneCalculeeService);
  private readonly categorieCrService = inject(CategorieCrService);
  private readonly sousCategorieCrService = inject(SousCategorieCrService);
  private readonly countDashService = inject(CountDashService);
  private readonly cbDashService = inject(CBDashService);
  private readonly courbDashService = inject(CourbDashService);
  private readonly clesService = inject(ClesDeRepartitionService);

  readonly societeId = signal<number | null>(null);
  readonly societeName = signal<string>('Société');
  readonly readonlyMode = signal<boolean>(false);
  readonly loading = signal(false);
  readonly metrics = signal<DashboardMetric[]>([]);
  readonly newMetricKey = signal<string | null>(null);
  readonly newMetricColor = signal<string | null>(null);
  readonly countDashEntries = signal<CountDash[]>([]);
  readonly cbDashEntries = signal<CBDash[]>([]);

  readonly visibleMetrics = computed(() => this.metrics().filter(m => m.enabled));
  readonly hasEnabledMetrics = computed(() => this.metrics().some(m => m.enabled));

  // Données brutes pour les graphiques
  readonly allRapports = signal<RapportFinancier[]>([]);
  readonly allCategories = signal<CategorieFinanciere[]>([]);
  readonly allSousCategories = signal<SousCategorieFinanciere[]>([]);
  readonly allLignes = signal<LigneFinanciere[]>([]);
  readonly allLignesCalculees = signal<LigneCalculee[]>([]);
  readonly rapportsForSociete = signal<RapportFinancier[]>([]);

  // Données pour les courbes mensuelles
  readonly months = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Aout',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre'
  ];
  readonly clesByMonth = signal<Record<string, ClesDeRepartition>>({});
  readonly lineChartRapport1Id = signal<number | null>(null);
  readonly lineChartRapport2Id = signal<number | null>(null);

  readonly lineChartLabels = computed(() => this.months);
  readonly lineChartSeries = computed<LineChartSeries[]>(() => {
    const r1 = this.lineChartRapport1Id();
    const r2 = this.lineChartRapport2Id();
    const series: LineChartSeries[] = [];

    if (r1 != null) {
      series.push({
        label: this.getRapportLabel(r1),
        data: this.computeMonthlyTotalsForRapport(r1),
        color: '#2563eb'
      });
    }

    if (r2 != null) {
      series.push({
        label: this.getRapportLabel(r2),
        data: this.computeMonthlyTotalsForRapport(r2),
        color: '#f97316'
      });
    }

    return series;
  });

  // Courbes sauvegardées (par catégorie / sous-catégorie + 2 rapports)
  readonly courbes = signal<CourbeConfig[]>([]);
  private courbeIdCounter = 1;
  readonly newCourbeCategoryId = signal<number | null>(null);
  readonly newCourbeSousCategorieId = signal<number | null>(null);
  readonly newCourbeRapport1Id = signal<number | null>(null);
  readonly newCourbeRapport2Id = signal<number | null>(null);

  // Configuration de création de graphique
  readonly customCharts = signal<CustomChartConfig[]>([]);
  readonly newChartShape = signal<ChartShape>('circle');
  readonly newChartDimension = signal<ChartDimension>('categorie');
  readonly newChartRapportId = signal<number | null>(null);
  readonly newChartFilterId = signal<number | null>(null);
  // Sélection pas à pas pour le builder : catégorie puis sous-catégorie
  readonly builderCategoryId = signal<number | null>(null);
  readonly builderSousCategorieId = signal<number | null>(null);

  private chartIdCounter = 1;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/dashboard', 'societes']);
      return;
    }
    // déterminer si on est en mode lecture seule (vue société)
    const readonly = !!this.route.snapshot.data['readonly'];
    this.readonlyMode.set(readonly);

    this.societeId.set(id);
    this.loadSociete(id);
    this.loadMetrics(id);

    // Expose a debug helper to call from the browser console:
    // showDashboardLines(rapportId:number|null, categorieId:number|null, sousCategorieId:number|null, lineName?:string)
    const self = this;
    (window as any).showDashboardLines = function (
      rapportId: number | null = null,
      categorieId: number | null = null,
      sousCategorieId: number | null = null,
      lineName?: string | null
    ) {
      const rapports = self.allRapports();
      const categories = self.allCategories();
      const sousCategories = self.allSousCategories();
      const lignes = self.allLignes();

      const rapportById = new Map<number, RapportFinancier>();
      for (const r of rapports) if (r.id != null) rapportById.set(r.id, r);

      const categorieById = new Map<number, CategorieFinanciere>();
      for (const c of categories) if (c.id != null) categorieById.set(c.id, c);

      const sousById = new Map<number, SousCategorieFinanciere>();
      for (const s of sousCategories) if (s.id != null) sousById.set(s.id, s);

      const matched = lignes
        .map((l) => {
          const sous = sousById.get(l.sousCategorieFinanciereId);
          const cat = sous ? categorieById.get(sous.categorieFinanciereId) : undefined;
          const rapport = cat && cat.rapportFinancierId != null ? rapportById.get(cat.rapportFinancierId) : undefined;
          return {
            id: l.id,
            nom: l.nom,
            montant: (l as any)?.montant ?? null,
            annee: (l as any)?.annee ?? null,
            mois: (l as any)?.mois ?? null,
            sousCategorieId: sous?.id ?? null,
            sousCategorieNom: sous?.nom ?? null,
            categorieId: cat?.id ?? null,
            categorieNom: cat?.nom ?? null,
            rapportId: rapport?.id ?? null,
            rapportAnnee: rapport?.annee ?? null
          };
        })
        .filter((x) => {
          if (rapportId != null && x.rapportId !== rapportId) return false;
          if (categorieId != null && x.categorieId !== categorieId) return false;
          if (sousCategorieId != null && x.sousCategorieId !== sousCategorieId) return false;
          if (lineName != null && lineName !== '' && typeof x.nom === 'string') {
            return x.nom.toLowerCase().includes(String(lineName).toLowerCase());
          }
          return true;
        });

      console.groupCollapsed('[Dashboard DEBUG] Matching financial lines');
      console.table(matched);
      console.log('Matches:', matched.length);
      console.groupEnd();
      return matched;
    };
  }

  private loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s) => this.societeName.set(s?.nom ?? 'Société'),
      error: () => this.societeName.set('Société')
    });
  }

  private loadMetrics(id: number): void {
    this.loading.set(true);

    forkJoin({
      users: this.userSocieteService.getAll(),
      produits: this.produitService.getAll(),
      rapports: this.rapportService.getAll(),
      categories: this.categorieService.getAll(),
      sousCategories: this.sousCategorieService.getAll(),
      familles: this.familleProduitService.getAll(),
      typesClient: this.typeClientService.getAll(),
      lignes: this.ligneService.getAll(),
      lignesCalculees: this.ligneCalculeeService.getAll(),
      categoriesCr: this.categorieCrService.getAll(),
      sousCategoriesCr: this.sousCategorieCrService.getAll(),
      countDash: this.countDashService.getAll(),
      cbDash: this.cbDashService.getAll(),
      cles: this.clesService.getAll(),
      courbDash: this.courbDashService.getAll()
    }).subscribe({
      next: ({ users, produits, rapports, categories, sousCategories, familles, typesClient, lignes, lignesCalculees, categoriesCr, sousCategoriesCr, countDash, cbDash, cles, courbDash }) => {
        const usersForSociete = (users ?? []).filter((u: UserSociete) => u.societeId === id);
        const rapportsForSociete = (rapports ?? []).filter((r: RapportFinancier) => r.societeId === id);
        const rapportIds = new Set(
          rapportsForSociete
            .map((r: RapportFinancier) => r.id)
            .filter((val): val is number => val != null)
        );
        const categoriesForSociete = (categories ?? []).filter((c: CategorieFinanciere) =>
          rapportIds.has(c.rapportFinancierId)
        );

        // stocker les données pour les graphiques
        this.allRapports.set(rapports ?? []);
        this.allCategories.set(categories ?? []);
        this.allSousCategories.set(sousCategories ?? []);
        this.allLignes.set(lignes ?? []);
        this.allLignesCalculees.set(lignesCalculees ?? []);
        this.rapportsForSociete.set(rapportsForSociete);

        // Debug demandé: afficher les valeurs des lignes financières dans la console
        this.logFinancialLinesDebug(id);

        // cles de répartition par mois pour la société
        const clesMap: Record<string, ClesDeRepartition> = {};
        (cles ?? [])
          .filter((c: ClesDeRepartition) => c.societeId === id || (c as any).idSociete === id)
          .forEach((c) => {
            if (c.mois) {
              clesMap[this.normalizeMonthKey(c.mois)] = c;
            }
          });
        this.clesByMonth.set(clesMap);

        const entriesForSociete = (countDash ?? []).filter((c) => c.societeId === id);
        this.countDashEntries.set(entriesForSociete);

        const cbEntriesForSociete = (cbDash ?? []).filter((c) => c.societeId === id);
        this.cbDashEntries.set(cbEntriesForSociete);

        const baseMetrics: DashboardMetric[] = [
          {
            key: 'users',
            label: 'Utilisateurs',
            description: "Nombre d'utilisateurs affectés à la société",
            value: usersForSociete.length,
            colorClass: 'metric--yellow',
            enabled: true
          },
          {
            key: 'produits',
            label: 'Produits',
            description: 'Nombre total de produits disponibles',
            value: (produits ?? []).length,
            colorClass: 'metric--orange',
            enabled: true
          },
          {
            key: 'familles',
            label: 'Familles produit',
            description: 'Nombre de familles de produits',
            value: (familles ?? []).length,
            colorClass: 'metric--teal',
            enabled: true
          },
          {
            key: 'typesClient',
            label: 'Types client',
            description: 'Nombre de types de client',
            value: (typesClient ?? []).length,
            colorClass: 'metric--blue',
            enabled: true
          },
          {
            key: 'rapports',
            label: 'Rapports',
            description: 'Nombre de rapports financiers créés pour la société',
            value: rapportsForSociete.length,
            colorClass: 'metric--pink',
            enabled: true
          },
          {
            key: 'categories',
            label: 'Catégories financières',
            description: 'Catégories du tableau liées aux rapports de la société',
            value: categoriesForSociete.length,
            colorClass: 'metric--purple',
            enabled: true
          },
          {
            key: 'lignesFinancieres',
            label: 'Lignes financières',
            description: 'Nombre total de lignes financières',
            value: (lignes ?? []).length,
            colorClass: 'metric--indigo',
            enabled: false
          },
          {
            key: 'categoriesCr',
            label: 'Catégories CR',
            description: 'Catégories du rapport CR (toutes sociétés)',
            value: (categoriesCr ?? []).length,
            colorClass: 'metric--pink',
            enabled: false
          },
          {
            key: 'sousCategoriesCr',
            label: 'Sous-catégories CR',
            description: 'Sous-catégories du rapport CR (toutes sociétés)',
            value: (sousCategoriesCr ?? []).length,
            colorClass: 'metric--gray',
            enabled: false
          }
        ];

        const enabledFromDb = new Set<string>();
        const colorByKey = new Map<string, string>();

        for (const e of entriesForSociete) {
          if (!e.nomEntity) continue;
          enabledFromDb.add(e.nomEntity);
          const col = (e as any).color ?? (e as any).couleur ?? e.color ?? e.couleur ?? null;
          if (col) {
            colorByKey.set(e.nomEntity, col);
          }
        }

        if (enabledFromDb.size > 0) {
          baseMetrics.forEach((m) => {
            m.enabled = enabledFromDb.has(m.key);
            const c = colorByKey.get(m.key);
            if (c) {
              m.customColor = c;
            }
          });
        }

        this.metrics.set(baseMetrics);

        // reconstruire les graphiques à partir de CBDash
        const restoredCharts: CustomChartConfig[] = [];
        for (const entry of cbEntriesForSociete) {
          const shape: ChartShape = entry.type === 'bar' ? 'bar' : 'circle';
          const dimension: ChartDimension = this.normalizeChartDimension(entry.category);

          const filterId = entry.sousCategory != null ? Number(entry.sousCategory) : NaN;
          const parsedFilterId = Number.isNaN(filterId) ? null : filterId;

          const rapportIdRaw = (entry as any).rapportId;
          const parsedRapportId =
            rapportIdRaw != null && !Number.isNaN(Number(rapportIdRaw))
              ? Number(rapportIdRaw)
              : null;

          const inferredRapportId = (() => {
            const categoryId = parsedFilterId != null && dimension !== 'categorie' ? parsedFilterId : null;
            if (categoryId == null) {
              return null;
            }
            const category = this.allCategories().find((c) => c.id === categoryId);
            const catRapportId = category?.rapportFinancierId ?? null;
            return catRapportId != null ? catRapportId : null;
          })();

          const localId = this.chartIdCounter++;
          restoredCharts.push({
            id: localId,
            dbId: entry.id ?? null,
            shape,
            dimension,
            rapportId: parsedRapportId ?? inferredRapportId,
            filterId: parsedFilterId
          });
        }

        if (restoredCharts.length) {
          this.customCharts.set(restoredCharts);
        }

        // reconstruire les courbes sauvegardées (CourbDash)
        const courbesForSociete = (courbDash ?? []).filter((c) => c.societeId === id);
        const restoredCourbes: CourbeConfig[] = [];
        for (const entry of courbesForSociete) {
          const localId = this.courbeIdCounter++;
          const r1Num = entry.rapport1 != null ? Number(entry.rapport1) : NaN;
          const r2Num = entry.rapport2 != null ? Number(entry.rapport2) : NaN;
          restoredCourbes.push({
            id: localId,
            dbId: entry.id ?? null,
            categorieId: entry.category != null ? Number(entry.category) : null,
            sousCategorieId: entry.sousCategory != null ? Number(entry.sousCategory) : null,
            rapport1Id: Number.isNaN(r1Num) ? null : r1Num,
            rapport2Id: Number.isNaN(r2Num) ? null : r2Num
          });
        }
        if (restoredCourbes.length) {
          this.courbes.set(restoredCourbes);
        }

        this.loading.set(false);
      },
      error: () => {
        this.metrics.set([]);
        this.loading.set(false);
      }
    });
  }

  // ----- Configuration des graphiques personnalisés -----

  setNewChartShape(value: string): void {
    if (value === 'circle' || value === 'bar') {
      this.newChartShape.set(value);
    }
  }

  setNewChartDimension(value: string): void {
    if (value === 'categorie' || value === 'sousCategorie' || value === 'ligne') {
      this.newChartDimension.set(value);
      // réinitialiser le filtre détail quand on change de niveau
      this.newChartFilterId.set(null);
    }
  }

  setNewChartRapportId(value: string): void {
    const num = Number(value);
    const id = Number.isNaN(num) ? null : num;
    this.newChartRapportId.set(id);
    // Rapport first: when it changes, clear the dependent selections.
    this.builderCategoryId.set(null);
    this.builderSousCategorieId.set(null);
    const rapport = id != null ? this.rapportsForSociete().find((r) => r.id === id) : null;
    console.log('[Dashboard] selected rapport', {
      rapportId: id,
      rapportAnnee: rapport?.annee ?? null,
      rapportLabel: rapport ? `Rapport ${rapport.annee}` : 'Tous les rapports'
    });
  }

  setNewChartFilterId(value: string): void {
    const num = Number(value);
    this.newChartFilterId.set(Number.isNaN(num) ? null : num);
  }

  // Sélection du builder : catégorie puis sous‑catégorie
  setBuilderCategoryId(value: string): void {
    const num = Number(value);
    const id = Number.isNaN(num) ? null : num;
    this.builderCategoryId.set(id);
    // quand on change de catégorie, on réinitialise la sous‑catégorie
    this.builderSousCategorieId.set(null);
  }

  setBuilderSousCategorieId(value: string): void {
    const num = Number(value);
    this.builderSousCategorieId.set(Number.isNaN(num) ? null : num);
  }

  getBuilderCategoryOptions(): { id: number; label: string }[] {
    const categories = this.allCategories();
    const selectedRapportId = this.newChartRapportId();
    if (!categories.length || selectedRapportId == null) {
      return [];
    }
    return categories
      .filter((c) => c.id != null && c.rapportFinancierId === selectedRapportId)
      .map((c) => ({ id: c.id as number, label: c.nom ?? `Catégorie ${c.id}` }));
  }

  getBuilderSousCategorieOptions(): { id: number; label: string }[] {
    const catId = this.builderCategoryId();
    const selectedRapportId = this.newChartRapportId();
    const sousCategories = this.allSousCategories();
    if (!catId || !sousCategories.length || selectedRapportId == null) {
      return [];
    }

    const category = this.allCategories().find((c) => c.id === catId);
    if (!category || category.rapportFinancierId !== selectedRapportId) {
      return [];
    }

    return sousCategories
      .filter((s) => s.id != null && s.categorieFinanciereId === catId)
      .map((s) => ({ id: s.id as number, label: s.nom ?? `Sous-catégorie ${s.id}` }));
  }

  addChart(): void {
    const societeId = this.societeId();
    if (!societeId) {
      return;
    }

    const categoryId = this.builderCategoryId();
    const sousCatId = this.builderSousCategorieId();
    const rapportId = this.newChartRapportId();

    if (rapportId == null) {
      return;
    }

    // déterminer la dimension et le filtre selon ce que l'utilisateur a choisi
    let dimension: ChartDimension;
    let filterId: number | null = null;

    if (sousCatId != null) {
      // Catégorie + sous‑catégorie choisis -> vue par lignes de la sous‑catégorie
      dimension = 'ligne';
      filterId = sousCatId;
    } else if (categoryId != null) {
      // Seule la catégorie est choisie -> vue par sous‑catégories de cette catégorie
      dimension = 'sousCategorie';
      filterId = categoryId;
    } else {
      // rien de sélectionné : on ne crée pas de graphique
      return;
    }

    const tempId = this.chartIdCounter++;
    const baseConfig: CustomChartConfig = {
      id: tempId,
      dbId: null,
      shape: this.newChartShape(),
      dimension,
      rapportId,
      filterId
    };

    const payload: CBDash = {
      societeId,
      type: baseConfig.shape,
      category: baseConfig.dimension,
      sousCategory: baseConfig.filterId != null ? String(baseConfig.filterId) : null,
      rapportId: baseConfig.rapportId
    };

    this.cbDashService.create(payload).subscribe((created) => {
      const config: CustomChartConfig = {
        ...baseConfig,
        dbId: created.id ?? null
      };
      this.customCharts.set([...this.customCharts(), config]);
      this.cbDashEntries.set([...this.cbDashEntries(), created]);
    });
  }

  removeChart(id: number): void {
    const current = this.customCharts();
    const cfg = current.find((c) => c.id === id);

    if (cfg?.dbId != null) {
      this.cbDashService.delete(cfg.dbId).subscribe(() => {
        this.customCharts.set(current.filter((c) => c.id !== id));
        this.cbDashEntries.set(this.cbDashEntries().filter((e) => e.id !== cfg.dbId));
      });
    } else {
      this.customCharts.set(current.filter((c) => c.id !== id));
    }
  }

  updateChartRapport(id: number, value: string): void {
    const num = Number(value);
    const rapportId = Number.isNaN(num) ? null : num;
    const updated = this.customCharts().map((c) =>
      c.id === id ? { ...c, rapportId } : c
    );
    this.customCharts.set(updated);
  }

  getRapportLabel(rapportId: number | null): string {
    if (rapportId == null) {
      return 'Tous les rapports';
    }
    const r = this.rapportsForSociete().find((x) => x.id === rapportId);
    return r ? String(r.annee) : String(rapportId);
  }

  getFilterLabel(config: CustomChartConfig): string {
    if (config.filterId == null) {
      return 'Tous';
    }

    const dimension = this.normalizeChartDimension(config.dimension as any);

    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();

    if (dimension === 'categorie') {
      const cat = categories.find((c) => c.id === config.filterId);
      return cat?.nom ?? `Catégorie ${config.filterId}`;
    }

    if (dimension === 'sousCategorie') {
      const cat = categories.find((c) => c.id === config.filterId);
      return cat?.nom ? `Catégorie ${cat.nom}` : `Catégorie ${config.filterId}`;
    }

    if (dimension === 'ligne') {
      const sous = sousCategories.find((s) => s.id === config.filterId);
      if (!sous) {
        const cat = categories.find((c) => c.id === config.filterId);
        if (cat?.nom) {
          return `Catégorie ${cat.nom}`;
        }
      }
      return sous?.nom ?? `Sous-catégorie ${config.filterId}`;
    }

    return 'Tous';
  }

  getBuilderFilterOptions(): { id: number; label: string }[] {
    const dimension = this.newChartDimension();
    const rapportId = this.newChartRapportId();
    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();
    const lignes = this.allLignes();

    if (dimension === 'categorie') {
      // détail = catégories financières
      let filteredCats = categories;
      if (rapportId != null) {
        filteredCats = categories.filter((c) => c.rapportFinancierId === rapportId);
      }
      return filteredCats
        .filter((c) => c.id != null)
        .map((c) => ({ id: c.id as number, label: c.nom ?? `Catégorie ${c.id}` }));
    }

    if (dimension === 'sousCategorie') {
      // détail = sous‑catégories
      let filteredSous = sousCategories;
      if (rapportId != null) {
        const catIds = new Set(
          categories
            .filter((c) => c.rapportFinancierId === rapportId && c.id != null)
            .map((c) => c.id as number)
        );
        filteredSous = sousCategories.filter((s) => catIds.has(s.categorieFinanciereId));
      }
      return filteredSous
        .filter((s) => s.id != null)
        .map((s) => ({ id: s.id as number, label: s.nom ?? `Sous-catégorie ${s.id}` }));
    }

    if (dimension === 'ligne') {
      // on peut plus tard proposer les lignes; pour l'instant on reste sur les sous‑catégories
      let filteredSous = sousCategories;
      if (rapportId != null) {
        const catIds = new Set(
          categories
            .filter((c) => c.rapportFinancierId === rapportId && c.id != null)
            .map((c) => c.id as number)
        );
        filteredSous = sousCategories.filter((s) => catIds.has(s.categorieFinanciereId));
      }
      return filteredSous
        .filter((s) => s.id != null)
        .map((s) => ({ id: s.id as number, label: s.nom ?? `Sous-catégorie ${s.id}` }));
    }

    return [];
  }

  // ----- Builder pour les courbes sauvegardées (CourbDash) -----

  setNewCourbeCategoryId(value: string): void {
    const num = Number(value);
    const id = Number.isNaN(num) ? null : num;
    this.newCourbeCategoryId.set(id);
    this.newCourbeSousCategorieId.set(null);
  }

  setNewCourbeSousCategorieId(value: string): void {
    const num = Number(value);
    this.newCourbeSousCategorieId.set(Number.isNaN(num) ? null : num);
  }

  setNewCourbeRapport1Id(value: string): void {
    const num = Number(value);
    this.newCourbeRapport1Id.set(Number.isNaN(num) ? null : num);
  }

  setNewCourbeRapport2Id(value: string): void {
    const num = Number(value);
    this.newCourbeRapport2Id.set(Number.isNaN(num) ? null : num);
  }

  getCourbeCategoryOptions(): { id: number; label: string }[] {
    return this.getBuilderCategoryOptions();
  }

  getCourbeSousCategorieOptions(): { id: number; label: string }[] {
    const catId = this.newCourbeCategoryId();
    const sousCategories = this.allSousCategories();
    if (!catId || !sousCategories.length) {
      return [];
    }
    return sousCategories
      .filter((s) => s.id != null && s.categorieFinanciereId === catId)
      .map((s) => ({ id: s.id as number, label: s.nom ?? `Sous-catégorie ${s.id}` }));
  }

  addCourbe(): void {
    const societeId = this.societeId();
    if (!societeId) {
      return;
    }

    const categorieId = this.newCourbeCategoryId();
    const sousCategorieId = this.newCourbeSousCategorieId();
    const rapport1Id = this.newCourbeRapport1Id();
    const rapport2Id = this.newCourbeRapport2Id();

    if (!categorieId || !sousCategorieId || !rapport1Id || !rapport2Id) {
      return;
    }

    const payload: CourbDash = {
      societeId,
      category: String(categorieId),
      sousCategory: String(sousCategorieId),
      rapport1: String(rapport1Id),
      rapport2: String(rapport2Id)
    };

    this.courbDashService.create(payload).subscribe((created) => {
      const localId = this.courbeIdCounter++;
      const cfg: CourbeConfig = {
        id: localId,
        dbId: created.id ?? null,
        categorieId,
        sousCategorieId,
        rapport1Id: created.rapport1 != null && !Number.isNaN(Number(created.rapport1)) ? Number(created.rapport1) : rapport1Id,
        rapport2Id: created.rapport2 != null && !Number.isNaN(Number(created.rapport2)) ? Number(created.rapport2) : rapport2Id
      };
      this.courbes.set([...this.courbes(), cfg]);
    });
  }

  removeCourbe(id: number): void {
    const current = this.courbes();
    const cfg = current.find((c) => c.id === id);

    if (cfg?.dbId != null) {
      this.courbDashService.delete(cfg.dbId).subscribe(() => {
        this.courbes.set(current.filter((c) => c.id !== id));
      });
    } else {
      this.courbes.set(current.filter((c) => c.id !== id));
    }
  }

  updateCourbeRapport1(id: number, value: string): void {
    const num = Number(value);
    const rapportId = Number.isNaN(num) ? null : num;
    const updated = this.courbes().map((c) =>
      c.id === id ? { ...c, rapport1Id: rapportId } : c
    );
    this.courbes.set(updated);
  }

  updateCourbeRapport2(id: number, value: string): void {
    const num = Number(value);
    const rapportId = Number.isNaN(num) ? null : num;
    const updated = this.courbes().map((c) =>
      c.id === id ? { ...c, rapport2Id: rapportId } : c
    );
    this.courbes.set(updated);
  }

  saveCourbe(id: number): void {
    const societeId = this.societeId();
    if (!societeId) {
      return;
    }

    const courbe = this.courbes().find((c) => c.id === id);
    if (!courbe || courbe.dbId == null || !courbe.categorieId || !courbe.sousCategorieId || !courbe.rapport1Id || !courbe.rapport2Id) {
      return;
    }

    const payload: CourbDash = {
      id: courbe.dbId,
      societeId,
      category: String(courbe.categorieId),
      sousCategory: String(courbe.sousCategorieId),
      rapport1: String(courbe.rapport1Id),
      rapport2: String(courbe.rapport2Id)
    };

    this.courbDashService.update(courbe.dbId, payload).subscribe();
  }

  setLineChartRapport1Id(value: string): void {
    const num = Number(value);
    this.lineChartRapport1Id.set(Number.isNaN(num) ? null : num);
  }

  setLineChartRapport2Id(value: string): void {
    const num = Number(value);
    this.lineChartRapport2Id.set(Number.isNaN(num) ? null : num);
  }

  private computeMonthlyTotalsForRapport(rapportId: number, categorieId?: number | null, sousCategorieId?: number | null): number[] {
    const societeId = this.societeId();
    if (!societeId) {
      return [];
    }

    const rapports = this.allRapports();
    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();
    const lignes = this.allLignes();
    const lignesCalculees = this.allLignesCalculees();
    const clesByMonth = this.clesByMonth();

    if (!rapports.length || !categories.length || !sousCategories.length || (!lignes.length && !lignesCalculees.length)) {
      return [];
    }

    const rapportById = new Map<number, RapportFinancier>();
    for (const r of rapports) {
      const id = this.toId((r as any).id);
      if (id != null) {
        rapportById.set(id, r);
      }
    }

    const categorieById = new Map<number, CategorieFinanciere>();
    for (const c of categories) {
      const id = this.toId((c as any).id);
      if (id != null) {
        categorieById.set(id, c);
      }
    }

    const sousCategorieById = new Map<number, SousCategorieFinanciere>();
    for (const s of sousCategories) {
      const id = this.toId((s as any).id);
      if (id != null) {
        sousCategorieById.set(id, s);
      }
    }

    const targetRapport = rapportById.get(rapportId);
    if (!targetRapport || targetRapport.societeId !== societeId) {
      return [];
    }

    const validCategorieIdsForRapport = new Set<number>(
      categories
        .filter((c) => this.toId((c as any).rapportFinancierId) === rapportId)
        .map((c) => this.toId((c as any).id))
        .filter((v): v is number => v != null)
    );

    const validSousCategorieIdsForRapport = new Set<number>(
      sousCategories
        .filter((s) => {
          const catId = this.toId((s as any).categorieFinanciereId);
          return catId != null && validCategorieIdsForRapport.has(catId);
        })
        .map((s) => this.toId((s as any).id))
        .filter((v): v is number => v != null)
    );

    // Si l'ID sauvegardé n'existe plus pour ce rapport, on ignore le filtre au lieu de vider la courbe.
    const effectiveCategorieId =
      categorieId != null && validCategorieIdsForRapport.has(categorieId) ? categorieId : null;
    const effectiveSousCategorieId =
      sousCategorieId != null && validSousCategorieIdsForRapport.has(sousCategorieId) ? sousCategorieId : null;

    const monthlyTotals = this.months.map(() => 0);

    for (const l of lignes) {
      const sousId = this.toId((l as any).sousCategorieFinanciereId);
      if (sousId == null) {
        continue;
      }
      const sousCat = sousCategorieById.get(sousId);
      if (!sousCat) {
        continue;
      }
      const catId = this.toId((sousCat as any).categorieFinanciereId);
      if (catId == null) {
        continue;
      }
      const cat = categorieById.get(catId);
      const catRapportId = this.toId((cat as any)?.rapportFinancierId);
      if (!cat || catRapportId == null || catRapportId !== rapportId) {
        continue;
      }

      const currentCatId = this.toId((cat as any).id);
      const currentSousId = this.toId((sousCat as any).id);

      if (effectiveCategorieId != null && currentCatId != null && currentCatId !== effectiveCategorieId) {
        continue;
      }

      if (effectiveSousCategorieId != null && currentSousId != null && currentSousId !== effectiveSousCategorieId) {
        continue;
      }

      const rawMontant = (l as any).montant;
      if (rawMontant == null || String(rawMontant).trim() === '') {
        continue;
      }
      const montant = this.toNumber(rawMontant);

      this.months.forEach((month, index) => {
        const cle = clesByMonth[this.normalizeMonthKey(month)];
        const coef = this.toNumber(cle?.saisonaliteCA);
        if (coef) {
          monthlyTotals[index] += montant * (coef / 100);
        }
      });
    }

    for (const lc of lignesCalculees) {
      const rawCalc = (lc as any).resultat;
      if (rawCalc == null || String(rawCalc).trim() === '') {
        continue;
      }
      const calcValue = this.toNumber(lc.resultat);

      const lcCategoryId = this.toId((lc as any).categorieFinanciereId);
      const lcSousId = this.toId((lc as any).sousCategorieFinanciereId);
      const lcRapportId = this.toId((lc as any).rapportFinancierId);

      const catFromCalc = lcCategoryId != null
        ? categorieById.get(lcCategoryId)
        : lcSousId != null
          ? categorieById.get(sousCategorieById.get(lcSousId)?.categorieFinanciereId as number)
          : undefined;

      const calcRapportId = lcRapportId ?? this.toId((catFromCalc as any)?.rapportFinancierId) ?? null;
      if (calcRapportId == null || calcRapportId !== rapportId) {
        continue;
      }

      if (effectiveCategorieId != null) {
        const calcCatId = lcCategoryId ?? this.toId((catFromCalc as any)?.id) ?? null;
        if (calcCatId == null || calcCatId !== effectiveCategorieId) {
          continue;
        }
      }

      if (effectiveSousCategorieId != null) {
        if (lcSousId == null || lcSousId !== effectiveSousCategorieId) {
          continue;
        }
      }

      this.months.forEach((month, index) => {
        const cle = clesByMonth[this.normalizeMonthKey(month)];
        const coef = this.toNumber(cle?.saisonaliteCA);
        if (coef) {
          monthlyTotals[index] += calcValue * (coef / 100);
        }
      });
    }

    return monthlyTotals;
  }

  getCourbeLabel(config: CourbeConfig): string {
    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();

    const cat = config.categorieId != null ? categories.find((c) => c.id === config.categorieId) : undefined;
    const sous = config.sousCategorieId != null ? sousCategories.find((s) => s.id === config.sousCategorieId) : undefined;

    const catLabel = cat?.nom ?? (config.categorieId != null ? `Catégorie ${config.categorieId}` : 'Catégorie');
    const sousLabel = sous?.nom ?? (config.sousCategorieId != null ? `Sous-catégorie ${config.sousCategorieId}` : 'Sous-catégorie');

    return `${catLabel} / ${sousLabel}`;
  }

  getCourbeSeries(config: CourbeConfig): LineChartSeries[] {
    const series: LineChartSeries[] = [];
    if (config.rapport1Id != null) {
      series.push({
        label: this.getRapportLabel(config.rapport1Id),
        data: this.computeMonthlyTotalsForRapport(config.rapport1Id, config.categorieId, config.sousCategorieId),
        color: '#2563eb'
      });
    }
    if (config.rapport2Id != null) {
      series.push({
        label: this.getRapportLabel(config.rapport2Id),
        data: this.computeMonthlyTotalsForRapport(config.rapport2Id, config.categorieId, config.sousCategorieId),
        color: '#f97316'
      });
    }
    return series;
  }

  private buildSlices(config: CustomChartConfig): ChartSlice[] {
    const societeId = this.societeId();
    if (!societeId) {
      return [];
    }

    const rapports = this.allRapports();
    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();
    const lignes = this.allLignes();
    const lignesCalculees = this.allLignesCalculees();

    if (!rapports.length || !categories.length || !sousCategories.length || (!lignes.length && !lignesCalculees.length)) {
      return [];
    }

    const rapportById = new Map<number, RapportFinancier>();
    for (const r of rapports) {
      const id = this.toId((r as any).id);
      if (id != null) {
        rapportById.set(id, r);
      }
    }

    const categorieById = new Map<number, CategorieFinanciere>();
    for (const c of categories) {
      const id = this.toId((c as any).id);
      if (id != null) {
        categorieById.set(id, c);
      }
    }

    const sousCategorieById = new Map<number, SousCategorieFinanciere>();
    for (const s of sousCategories) {
      const id = this.toId((s as any).id);
      if (id != null) {
        sousCategorieById.set(id, s);
      }
    }

    const buckets = new Map<string, number>();

    const dimension = this.normalizeChartDimension(config.dimension as any);
    const rawFilterId = this.toId((config as any).filterId);

    if (dimension === 'ligne') {
      const targetRapportId = config.rapportId ?? null;

      const matchesCurrentFilter = (catId: number | null, sousId: number | null): boolean => {
        if (rawFilterId == null) {
          return true;
        }

        if (catId != null && rawFilterId === catId) {
          return true;
        }

        if (sousId != null && rawFilterId === sousId) {
          return true;
        }

        return false;
      };

      for (const l of lignes) {
        const sousId = this.toId((l as any).sousCategorieFinanciereId);
        if (sousId == null) {
          continue;
        }

        const sousCat = sousCategorieById.get(sousId);
        if (!sousCat) {
          continue;
        }

        const catId = this.toId((sousCat as any).categorieFinanciereId);
        if (catId == null) {
          continue;
        }

        const cat = categorieById.get(catId);
        const catRapportId = this.toId((cat as any)?.rapportFinancierId);
        if (!cat || catRapportId == null) {
          continue;
        }

        const rapport = rapportById.get(catRapportId);
        if (!rapport || rapport.societeId !== societeId) {
          continue;
        }

        if (targetRapportId != null && rapport.id !== targetRapportId) {
          continue;
        }

        if (!matchesCurrentFilter(catId, sousId)) {
          continue;
        }

        const rawMontant = (l as any).montant;
        if (rawMontant == null || String(rawMontant).trim() === '') {
          continue;
        }

        const label = l.nom ?? `Ligne ${l.id}`;
        const current = buckets.get(label) ?? 0;
        buckets.set(label, current + this.toNumber(rawMontant));
      }

      for (const lc of lignesCalculees) {
        const rawCalc = (lc as any).resultat;
        if (rawCalc == null || String(rawCalc).trim() === '') {
          continue;
        }

        const lcSousId = this.toId((lc as any).sousCategorieFinanciereId);
        const lcCategoryId = this.toId((lc as any).categorieFinanciereId);
        const sousCat = lcSousId != null ? sousCategorieById.get(lcSousId) : undefined;
        const catId = lcCategoryId ?? (sousCat ? this.toId((sousCat as any).categorieFinanciereId) : null);
        const cat = catId != null ? categorieById.get(catId) : undefined;
        const lcRapportId = this.toId((lc as any).rapportFinancierId) ?? this.toId((cat as any)?.rapportFinancierId);
        const rapport = lcRapportId != null ? rapportById.get(lcRapportId) : undefined;

        if (!cat || !rapport || rapport.societeId !== societeId) {
          continue;
        }

        if (targetRapportId != null && rapport.id !== targetRapportId) {
          continue;
        }

        if (!matchesCurrentFilter(catId ?? null, lcSousId ?? null)) {
          continue;
        }

        const label = lc.nom ?? `Ligne calculée ${lc.id}`;
        const current = buckets.get(label) ?? 0;
        buckets.set(label, current + this.toNumber(rawCalc));
      }

      const entries = Array.from(buckets.entries());
      if (!entries.length) {
        return [];
      }

      const total = entries.reduce((sum, [, value]) => sum + value, 0);
      const colors = [
        '#f97316', '#22c55e', '#eab308', '#ec4899', '#6366f1', '#a855f7', '#06b6d4', '#fb7185'
      ];

      if (total === 0) {
        return entries.map(([label, value], index) => ({
          label,
          value,
          percentage: 0,
          color: colors[index % colors.length]
        }));
      }

      return entries.map(([label, value], index) => ({
        label,
        value,
        percentage: (value / total) * 100,
        color: colors[index % colors.length]
      }));
    }

    const categoryIdsForSocieteAndRapport = new Set<number>(
      categories
        .filter((c) => {
          const catRapportId = this.toId((c as any).rapportFinancierId);
          if (catRapportId == null) return false;
          const rapport = rapportById.get(catRapportId);
          if (!rapport || rapport.societeId !== societeId) return false;
          if (config.rapportId != null && rapport.id !== config.rapportId) return false;
          return true;
        })
        .map((c) => this.toId((c as any).id))
        .filter((v): v is number => v != null)
    );

    const sousCategorieIdsForSocieteAndRapport = new Set<number>(
      sousCategories
        .filter((s) => {
          const catId = this.toId((s as any).categorieFinanciereId);
          return catId != null && categoryIdsForSocieteAndRapport.has(catId);
        })
        .map((s) => this.toId((s as any).id))
        .filter((v): v is number => v != null)
    );

    // Compatibilité: certains anciens graphes 'ligne' ont un filterId de catégorie.
    // On les interprète comme "toutes les lignes de cette catégorie".
    const filterRule = (() => {
      if (rawFilterId == null) {
        return { invalid: false, categoryId: null as number | null, sousId: null as number | null };
      }

      if (dimension === 'categorie') {
        if (categoryIdsForSocieteAndRapport.has(rawFilterId)) {
          return { invalid: false, categoryId: rawFilterId, sousId: null as number | null };
        }
        return { invalid: true, categoryId: null as number | null, sousId: null as number | null };
      }

      if (dimension === 'sousCategorie') {
        if (categoryIdsForSocieteAndRapport.has(rawFilterId)) {
          return { invalid: false, categoryId: rawFilterId, sousId: null as number | null };
        }

        if (sousCategorieIdsForSocieteAndRapport.has(rawFilterId)) {
          const sous = sousCategorieById.get(rawFilterId);
          const parentCategoryId = this.toId((sous as any)?.categorieFinanciereId);
          if (parentCategoryId != null && categoryIdsForSocieteAndRapport.has(parentCategoryId)) {
            return { invalid: false, categoryId: parentCategoryId, sousId: null as number | null };
          }
        }

        return { invalid: true, categoryId: null as number | null, sousId: null as number | null };
      }

      // dimension === 'ligne'
      if (sousCategorieIdsForSocieteAndRapport.has(rawFilterId)) {
        const sous = sousCategorieById.get(rawFilterId);
        const parentCategoryId = this.toId((sous as any)?.categorieFinanciereId);
        return { invalid: false, categoryId: parentCategoryId, sousId: rawFilterId };
      }

      if (categoryIdsForSocieteAndRapport.has(rawFilterId)) {
        // Ancien format: filterId pointe une catégorie au lieu d'une sous-catégorie.
        return { invalid: false, categoryId: rawFilterId, sousId: null as number | null };
      }

      return { invalid: true, categoryId: null as number | null, sousId: null as number | null };
    })();

    if (filterRule.invalid) {
      return [];
    }

    // Fallback: certains graphes legacy pointent une sous-catégorie sans valeurs.
    // Dans ce cas on garde le filtre catégorie et on relâche le filtre sous-catégorie.
    let effectiveSousId = filterRule.sousId;
    if (filterRule.sousId != null) {
      const hasFinancialDataForSous = lignes.some((l) => {
        const sousId = this.toId((l as any).sousCategorieFinanciereId);
        if (sousId == null || sousId !== filterRule.sousId) {
          return false;
        }

        const sous = sousCategorieById.get(sousId);
        if (!sous) {
          return false;
        }

        const catId = this.toId((sous as any).categorieFinanciereId);
        if (filterRule.categoryId != null && catId !== filterRule.categoryId) {
          return false;
        }

        const cat = catId != null ? categorieById.get(catId) : undefined;
        const catRapportId = this.toId((cat as any)?.rapportFinancierId);
        const rapport = catRapportId != null ? rapportById.get(catRapportId) : undefined;
        if (!rapport || rapport.societeId !== societeId) {
          return false;
        }
        if (config.rapportId != null && rapport.id !== config.rapportId) {
          return false;
        }

        const rawMontant = (l as any).montant;
        return rawMontant != null && String(rawMontant).trim() !== '';
      });

      const hasCalculeeDataForSous = lignesCalculees.some((lc) => {
        const lcSousId = this.toId((lc as any).sousCategorieFinanciereId);
        if (lcSousId == null || lcSousId !== filterRule.sousId) {
          return false;
        }

        const lcCategoryId = this.toId((lc as any).categorieFinanciereId);
        const sous = sousCategorieById.get(lcSousId);
        const catId = lcCategoryId ?? this.toId((sous as any)?.categorieFinanciereId);
        if (filterRule.categoryId != null && catId !== filterRule.categoryId) {
          return false;
        }

        const cat = catId != null ? categorieById.get(catId) : undefined;
        const lcRapportId = this.toId((lc as any).rapportFinancierId) ?? this.toId((cat as any)?.rapportFinancierId);
        const rapport = lcRapportId != null ? rapportById.get(lcRapportId) : undefined;
        if (!rapport || rapport.societeId !== societeId) {
          return false;
        }
        if (config.rapportId != null && rapport.id !== config.rapportId) {
          return false;
        }

        const raw = (lc as any).resultat;
        return raw != null && String(raw).trim() !== '';
      });

      if (!hasFinancialDataForSous && !hasCalculeeDataForSous) {
        effectiveSousId = null;
      }
    }

    for (const l of lignes) {
      const sousId = this.toId((l as any).sousCategorieFinanciereId);
      if (sousId == null) {
        continue;
      }
      const sousCat = sousCategorieById.get(sousId);
      if (!sousCat) {
        continue;
      }
      const catId = this.toId((sousCat as any).categorieFinanciereId);
      if (catId == null) {
        continue;
      }
      const cat = categorieById.get(catId);
      const catRapportId = this.toId((cat as any)?.rapportFinancierId);
      if (!cat || catRapportId == null) {
        continue;
      }
      const rapport = rapportById.get(catRapportId);
      if (!rapport || rapport.societeId !== societeId) {
        continue;
      }

      if (config.rapportId != null && rapport.id !== config.rapportId) {
        continue;
      }

      // filtre supplémentaire selon la dimension choisie
      const currentCatId = this.toId((cat as any).id);
      const currentSousId = this.toId((sousCat as any).id);
      if (filterRule.categoryId != null) {
        if (currentCatId == null || currentCatId !== filterRule.categoryId) {
          continue;
        }
      }

      let label: string;
      if (dimension === 'sousCategorie') {
        label = sousCat.nom ?? `Sous-catégorie ${sousCat.id}`;
      } else {
        label = cat.nom ?? `Catégorie ${cat.id}`;
      }

      const current = buckets.get(label) ?? 0;
      buckets.set(label, current + this.toNumber((l as any).montant));
    }

    for (const lc of lignesCalculees) {
      const calcValue = this.toNumber(lc.resultat);
      if (!calcValue) {
        continue;
      }

      const lcCategoryId = this.toId((lc as any).categorieFinanciereId);
      const lcSousId = this.toId((lc as any).sousCategorieFinanciereId);
      const lcRapportId = this.toId((lc as any).rapportFinancierId);

      const sousCat = lcSousId != null
        ? sousCategorieById.get(lcSousId)
        : undefined;
      const cat = lcCategoryId != null
        ? categorieById.get(lcCategoryId)
        : sousCat
          ? categorieById.get(sousCat.categorieFinanciereId)
          : undefined;

      if (!cat || cat.rapportFinancierId == null) {
        continue;
      }

      const rapport = lcRapportId != null
        ? rapportById.get(lcRapportId)
        : rapportById.get(cat.rapportFinancierId);

      if (!rapport || rapport.societeId !== societeId) {
        continue;
      }

      if (config.rapportId != null && rapport.id !== config.rapportId) {
        continue;
      }

      const currentCatId = this.toId((cat as any).id);
      const currentSousId = this.toId((sousCat as any)?.id);
      if (filterRule.categoryId != null) {
        if (currentCatId == null || currentCatId !== filterRule.categoryId) {
          continue;
        }
      }

      let label: string;
      if (dimension === 'sousCategorie') {
        label = sousCat?.nom ?? cat.nom ?? `Sous-catégorie ${lcSousId ?? ''}`;
      } else {
        label = cat.nom ?? `Catégorie ${cat.id}`;
      }

      const current = buckets.get(label) ?? 0;
      buckets.set(label, current + calcValue);
    }

    const entries = Array.from(buckets.entries());
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!entries.length) {
      return [];
    }
    if (total === 0) {
      console.info('[Dashboard] Graphique: valeurs présentes mais somme = 0, renvoi des entrées avec pourcentage 0', {
        config,
        filterRule,
        effectiveSousId,
        societeId,
        lignesFinancieres: lignes.length,
        lignesCalculees: lignesCalculees.length
      });
      const colors = [
        '#f97316', '#22c55e', '#eab308', '#ec4899', '#6366f1', '#a855f7', '#06b6d4', '#fb7185'
      ];
      return entries.map(([label, value], index) => ({
        label,
        value,
        percentage: 0,
        color: colors[index % colors.length]
      }));
    }

    // Palette vive pour les barres et les cercles
    const colors = [
      '#f97316', // orange
      '#22c55e', // vert
      '#eab308', // jaune
      '#ec4899', // rose
      '#6366f1', // bleu
      '#a855f7', // violet
      '#06b6d4', // cyan
      '#fb7185'  // rouge rosé
    ];

    return entries.map(([label, value], index) => {
      const percentage = (value / total) * 100;
      const color = colors[index % colors.length];
      return { label, value, percentage, color } as ChartSlice;
    });
  }

  getChartSlices(config: CustomChartConfig): ChartSlice[] {
    return this.buildSlices(config);
  }

  getChartTotal(config: CustomChartConfig): number {
    return this.buildSlices(config).reduce((sum, slice) => sum + slice.value, 0);
  }

  buildCircleBackground(config: CustomChartConfig): string {
    const slices = this.buildSlices(config);
    if (!slices.length) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let currentAngle = 0;
    const parts: string[] = [];
    for (const s of slices) {
      const sweep = (s.percentage / 100) * 360;
      const start = currentAngle;
      const end = currentAngle + sweep;
      parts.push(`${s.color} ${start}deg ${end}deg`);
      currentAngle = end;
    }

    if (currentAngle < 360) {
      parts.push(`#e5e7eb ${currentAngle}deg 360deg`);
    }

    return `conic-gradient(${parts.join(', ')})`;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/\s+/g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private normalizeMonthKey(month: string): string {
    return (month || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private toId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private normalizeChartDimension(value: unknown): ChartDimension {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'ligne' || raw === 'line') {
      return 'ligne';
    }
    if (raw === 'souscategorie' || raw === 'sous-categorie' || raw.startsWith('sous')) {
      return 'sousCategorie';
    }
    return 'categorie';
  }

  private logFinancialLinesDebug(societeId: number): void {
    const rapports = this.allRapports();
    const categories = this.allCategories();
    const sousCategories = this.allSousCategories();
    const lignes = this.allLignes();

    const rapportById = new Map<number, RapportFinancier>();
    for (const r of rapports) {
      if (r.id != null) {
        rapportById.set(r.id, r);
      }
    }

    const categorieById = new Map<number, CategorieFinanciere>();
    for (const c of categories) {
      if (c.id != null) {
        categorieById.set(c.id, c);
      }
    }

    const sousById = new Map<number, SousCategorieFinanciere>();
    for (const s of sousCategories) {
      if (s.id != null) {
        sousById.set(s.id, s);
      }
    }

    const lignesSociete = lignes
      .map((l) => {
        const sous = sousById.get(l.sousCategorieFinanciereId);
        const cat = sous ? categorieById.get(sous.categorieFinanciereId) : undefined;
        const rapport = cat && cat.rapportFinancierId != null ? rapportById.get(cat.rapportFinancierId) : undefined;
        return {
          id: l.id,
          nom: l.nom,
          montant: this.toNumber((l as any).montant),
          sousCategorieId: sous?.id ?? null,
          sousCategorieNom: sous?.nom ?? null,
          categorieId: cat?.id ?? null,
          categorieNom: cat?.nom ?? null,
          rapportId: rapport?.id ?? null,
          rapportAnnee: rapport?.annee ?? null,
          rapportSocieteId: rapport?.societeId ?? null
        };
      })
      .filter((l) => l.rapportSocieteId === societeId);

    console.groupCollapsed('[Dashboard] Lignes financieres chargees');
    console.table(lignesSociete);
    console.log('Total lignes financieres (societe):', lignesSociete.length);
    console.groupEnd();
  }

  // ----- Configuration des compteurs (CountDash) -----

  setNewMetricKey(value: string): void {
    this.newMetricKey.set(value || null);
  }

  setNewMetricColor(value: string): void {
    this.newMetricColor.set(value || null);
  }

  addMetricFromSelector(): void {
    const key = this.newMetricKey();
    if (!key) {
      return;
    }
    this.toggleMetric(key, true, this.newMetricColor());
  }

  toggleMetric(key: string, enabled: boolean, color?: string | null): void {
    const id = this.societeId();
    if (!id) return;

    const updated = this.metrics().map(m => (m.key === key ? { ...m, enabled } : m));
    this.metrics.set(updated);

    const current = this.countDashEntries();
    const existing = current.find((e) => e.societeId === id && e.nomEntity === key);

    if (enabled) {
      const existingColor = (existing as any)?.color ?? (existing as any)?.couleur ?? existing?.color ?? existing?.couleur ?? null;
      const chosenColor = color ?? existingColor ?? null;

      if (!existing) {
        const payload: CountDash = { societeId: id, nomEntity: key, color: chosenColor, couleur: chosenColor };
        this.countDashService.create(payload).subscribe((created) => {
          this.countDashEntries.set([...this.countDashEntries(), created]);
          this.metrics.set(
            this.metrics().map((m) =>
              m.key === key
                ? {
                    ...m,
                    enabled: true,
                    customColor:
                      (created as any).color ?? (created as any).couleur ?? created.color ?? created.couleur ?? chosenColor ?? m.customColor
                  }
                : m
            )
          );
        });
      } else {
        const needsColorUpdate = chosenColor !== existingColor;
        if (needsColorUpdate && existing.id != null) {
          const payload: CountDash = { ...existing, color: chosenColor, couleur: chosenColor };
          this.countDashService.update(existing.id, payload).subscribe(() => {
            this.countDashEntries.set(
              this.countDashEntries().map((e) =>
                e.id === existing.id ? { ...e, color: chosenColor, couleur: chosenColor } : e
              )
            );
            this.metrics.set(
              this.metrics().map((m) =>
                m.key === key ? { ...m, enabled: true, customColor: chosenColor ?? m.customColor } : m
              )
            );
          });
        } else {
          // juste ré-activer sans changer la couleur
          this.metrics.set(
            this.metrics().map((m) => (m.key === key ? { ...m, enabled: true } : m))
          );
        }
      }
    } else {
      if (existing && existing.id != null) {
        this.countDashService.delete(existing.id).subscribe(() => {
          this.countDashEntries.set(this.countDashEntries().filter((e) => e.id !== existing.id));
        });
      }
    }
  }

  backToSocietes(): void {
    this.router.navigate(['/dashboard', 'societes']);
  }
}
