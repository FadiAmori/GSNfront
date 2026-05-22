export type TypeRapport = 0 | 1 | 2;

export interface RapportFinancier {
  statut?: any;
  id?: number;
  societeId: number;
  type: TypeRapport;
  annee: number;
}
