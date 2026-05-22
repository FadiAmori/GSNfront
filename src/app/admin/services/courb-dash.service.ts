import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CourbDash {
  id?: number;
  category?: string | null;
  sousCategory?: string | null;
  societeId: number;
  rapport1?: string | null;
  rapport2?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CourbDashService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CourbDash`;

  getAll(): Observable<CourbDash[]> {
    return this.http.get<CourbDash[]>(this.apiUrl);
  }

  create(payload: CourbDash): Observable<CourbDash> {
    return this.http.post<CourbDash>(this.apiUrl, payload);
  }

  update(id: number, payload: CourbDash): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}