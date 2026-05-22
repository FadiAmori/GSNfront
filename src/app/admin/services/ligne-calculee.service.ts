import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LigneCalculee } from './ligne-calculee.model';

export interface UpdateLigneCalculeeDto extends LigneCalculee {
  id: number;
}

export interface LigneCalculeeOrderItem {
  id: number | undefined;
  position: number | undefined;
}

@Injectable({ providedIn: 'root' })
export class LigneCalculeeService {

  private readonly apiUrl = `${environment.apiUrl}/LigneCalculee`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<LigneCalculee[]> {
    return this.http.get<LigneCalculee[]>(this.apiUrl);
  }

  create(item: LigneCalculee): Observable<LigneCalculee> {
    return this.http.post<LigneCalculee>(this.apiUrl, item);
  }

  update(item: LigneCalculee): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${item.id}`, item);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateOrder(items: LigneCalculeeOrderItem[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/order`, items);
  }
}
