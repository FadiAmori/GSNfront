import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CountDash {
  id?: number;
  nomEntity?: string | null;
  societeId: number;
  color?: string | null;
  couleur?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CountDashService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CountDash`;

  getAll(): Observable<CountDash[]> {
    return this.http.get<CountDash[]>(this.apiUrl);
  }

  create(payload: CountDash): Observable<CountDash> {
    return this.http.post<CountDash>(this.apiUrl, payload);
  }

  update(id: number, payload: CountDash): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}