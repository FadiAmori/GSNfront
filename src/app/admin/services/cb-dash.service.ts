import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CBDash {
  id?: number;
  type?: string | null;
  category?: string | null;
  sousCategory?: string | null;
  rapportId?: number | null;
  societeId: number;
}

@Injectable({ providedIn: 'root' })
export class CBDashService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CBDash`;

  getAll(): Observable<CBDash[]> {
    return this.http.get<CBDash[]>(this.apiUrl);
  }

  create(payload: CBDash): Observable<CBDash> {
    return this.http.post<CBDash>(this.apiUrl, payload);
  }

  update(id: number, payload: CBDash): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}