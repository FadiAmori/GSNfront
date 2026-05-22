import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SousCategorieFinanciere } from './sous-categorie-financiere.model';

@Injectable({ providedIn: 'root' })
export class SousCategorieFinanciereService {

  private readonly apiUrl = `${environment.apiUrl}/SousCategorieFinanciere`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<SousCategorieFinanciere[]> {
    return this.http.get<SousCategorieFinanciere[]>(this.apiUrl);
  }

  create(item: SousCategorieFinanciere): Observable<SousCategorieFinanciere> {
    return this.http.post<SousCategorieFinanciere>(this.apiUrl, item);
  }

  update(id: number, item: SousCategorieFinanciere): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
