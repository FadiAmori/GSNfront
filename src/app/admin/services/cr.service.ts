import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CR } from './cr.model';

@Injectable({
  providedIn: 'root'
})
export class CrService {

  private readonly apiUrl = `${environment.apiUrl}/CR`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<CR[]> {
    return this.http.get<CR[]>(this.apiUrl);
  }

  create(cr: CR): Observable<CR> {
    return this.http.post<CR>(this.apiUrl, cr);
  }
}
