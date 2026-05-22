import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClesDeRepartition {
  id?: number;
  mois?: string | null;
  saisonaliteCA: number;
  saisonalitePoids: number;
  clesCoutFixes: number;
  societeId: number;
  idSociete?: number;
}

@Injectable({ providedIn: 'root' })
export class ClesDeRepartitionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ClesDeRepartition`;

  getAll(): Observable<ClesDeRepartition[]> {
    return this.http.get<ClesDeRepartition[]>(this.apiUrl);
  }

  create(payload: ClesDeRepartition): Observable<ClesDeRepartition> {
    return this.http.post<ClesDeRepartition>(this.apiUrl, payload);
  }

  update(id: number, payload: ClesDeRepartition): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
