import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Produit {
  id?: number;
  nom?: string;
  code?: string;
  poidsPrevu?: number;
  tauxPoids?: number;
  tpsUnitaire?: number;
  tempsGlobal?: number;
  coutMODParHeure?: number;
  typeClientId?: number;
  familleProduitId?: number;
}

@Injectable({ providedIn: 'root' })
export class ProduitService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Produit`;

  getAll(): Observable<Produit[]> {
    return this.http.get<Produit[]>(this.apiUrl);
  }

  create(payload: Produit): Observable<Produit> {
    return this.http.post<Produit>(this.apiUrl, payload);
  }

  update(id: number, payload: Produit): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
