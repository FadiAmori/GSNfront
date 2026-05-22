import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TypeClient {
  id?: number;
  nom?: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TypeClientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/TypeClient`;

  getAll(): Observable<TypeClient[]> {
    return this.http.get<TypeClient[]>(this.apiUrl);
  }

  create(payload: TypeClient): Observable<TypeClient> {
    return this.http.post<TypeClient>(this.apiUrl, payload);
  }

  update(id: number, payload: TypeClient): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
