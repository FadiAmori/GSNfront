import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Societe } from './societe.model';

@Injectable({
  providedIn: 'root'
})
export class SocieteService {

  private readonly apiUrl = `${environment.apiUrl}/Societe`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Societe[]> {
    return this.http.get<Societe[]>(this.apiUrl);
  }

  getById(id: number): Observable<Societe> {
    return this.http.get<Societe>(`${this.apiUrl}/${id}`);
  }

  create(societe: Societe): Observable<Societe> {
    return this.http.post<Societe>(this.apiUrl, societe);
  }

  update(id: number, societe: Societe): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, societe);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
