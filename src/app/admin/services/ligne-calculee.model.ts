export interface LigneCalculee {
  id?: number;
  nom: string;
  expression: string;
  position?: number;
  resultat?: number | null;
  rapportFinancierId?: number;
  societeId?: number;
  categorieFinanciereId?: number | null;
  sousCategorieFinanciereId?: number | null;
  dateCreation?: string;
  color?: string | null;
  couleur?: string | null;
}
