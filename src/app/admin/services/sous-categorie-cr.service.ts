import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SousCategorieCR {
  id?: number;
  nom?: string | null;
  categorieCrId: number;
}

@Injectable({ providedIn: 'root' })
export class SousCategorieCrService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/SousCategorieCR`;

  getAll(): Observable<SousCategorieCR[]> {
    return this.http.get<SousCategorieCR[]>(this.apiUrl);
  }

  create(payload: SousCategorieCR): Observable<SousCategorieCR> {
    return this.http.post<SousCategorieCR>(this.apiUrl, payload);
  }

  update(id: number, payload: SousCategorieCR): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
