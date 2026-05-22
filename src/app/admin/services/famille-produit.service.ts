import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FamilleProduit {
  id?: number;
  nom?: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FamilleProduitService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/FamilleProduit`;

  getAll(): Observable<FamilleProduit[]> {
    return this.http.get<FamilleProduit[]>(this.apiUrl);
  }

  create(payload: FamilleProduit): Observable<FamilleProduit> {
    return this.http.post<FamilleProduit>(this.apiUrl, payload);
  }

  update(id: number, payload: FamilleProduit): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
