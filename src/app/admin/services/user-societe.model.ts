export type RoleSociete = 0 | 1;

export interface UserSociete {
  id?: number;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  password?: string;
  active: boolean;
  dateAffectation?: string;
  role: RoleSociete;
  societeId: number;
}
