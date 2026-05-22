export interface LigneFinanciere {
  id?: number;
  nom?: string;
  unite?: string;
  montant: number;
  mois: number;
  annee: number;
  sousCategorieFinanciereId: number;
  position?: number;
  color?: string | null;
  couleur?: string | null;
}
