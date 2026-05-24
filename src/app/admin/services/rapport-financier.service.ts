import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RapportFinancier } from './rapport-financier.model';

@Injectable({
  providedIn: 'root'
})
export class RapportFinancierService {

  private readonly apiUrl = `${environment.apiUrl}/RapportFinancier`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<RapportFinancier[]> {
    return this.http.get<RapportFinancier[]>(this.apiUrl);
  }

  getBySocieteId(societeId: number): Observable<RapportFinancier[]> {
    return this.http.get<RapportFinancier[]>(`${this.apiUrl}/societe/${societeId}`);
  }

  getById(id: number): Observable<RapportFinancier> {
    return this.http.get<RapportFinancier>(`${this.apiUrl}/${id}`);
  }

  create(rapport: RapportFinancier): Observable<RapportFinancier> {
    return this.http.post<RapportFinancier>(this.apiUrl, rapport);
  }

  /** Create rapport for a specific societe via admin route if supported */
  createForSociete(societeId: number, rapport: RapportFinancier): Observable<RapportFinancier> {
    return this.http.post<RapportFinancier>(`${this.apiUrl}/societe/${societeId}`, rapport);
  }

  update(id: number, rapport: RapportFinancier): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, rapport);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
