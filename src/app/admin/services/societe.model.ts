export interface Societe {
  id?: number;
  nom: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  telephone?: string;
  email?: string;
  password?: string;
  active: boolean;
  dateAffectation?: string;
  dateCreation?: string;
}
