import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategorieFinanciere } from './categorie-financiere.model';

@Injectable({ providedIn: 'root' })
export class CategorieFinanciereService {

  private readonly apiUrl = `${environment.apiUrl}/CategorieFinanciere`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<CategorieFinanciere[]> {
    return this.http.get<CategorieFinanciere[]>(this.apiUrl);
  }

  create(item: CategorieFinanciere): Observable<CategorieFinanciere> {
    return this.http.post<CategorieFinanciere>(this.apiUrl, item);
  }

  update(id: number, item: CategorieFinanciere): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
