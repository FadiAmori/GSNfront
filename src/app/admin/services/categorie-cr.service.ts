import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CategorieCR {
  id?: number;
  nom?: string | null;
  rapportFinancierId: number;
}

@Injectable({ providedIn: 'root' })
export class CategorieCrService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CategorieCR`;

  getAll(): Observable<CategorieCR[]> {
    return this.http.get<CategorieCR[]>(this.apiUrl);
  }

  create(payload: CategorieCR): Observable<CategorieCR> {
    return this.http.post<CategorieCR>(this.apiUrl, payload);
  }

  update(id: number, payload: CategorieCR): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
