import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LigneFinanciere } from './ligne-financiere.model';

@Injectable({ providedIn: 'root' })
export class LigneFinanciereService {

  private readonly apiUrl = `${environment.apiUrl}/LigneFinanciere`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<LigneFinanciere[]> {
    return this.http.get<LigneFinanciere[]>(this.apiUrl);
  }

  create(item: LigneFinanciere): Observable<LigneFinanciere> {
    return this.http.post<LigneFinanciere>(this.apiUrl, item);
  }

  update(id: number, item: LigneFinanciere): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, item);
  }

  patchMontant(id: number, montant: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/montant`, montant);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
