import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserSociete } from './user-societe.model';

@Injectable({
  providedIn: 'root'
})
export class UserSocieteService {

  private readonly apiUrl = `${environment.apiUrl}/UserSociete`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<UserSociete[]> {
    return this.http.get<UserSociete[]>(this.apiUrl);
  }

  create(user: UserSociete): Observable<UserSociete> {
    return this.http.post<UserSociete>(this.apiUrl, user);
  }

  update(id: number, user: UserSociete): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, user);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
