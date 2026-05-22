import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExcelLigneCalculee } from './excel-ligne-calculee.model';

@Injectable({ providedIn: 'root' })
export class ExcelLigneCalculeeService {

  private readonly apiUrl = `${environment.apiUrl}/ExcelLigneCalculee`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ExcelLigneCalculee[]> {
    return this.http.get<ExcelLigneCalculee[]>(this.apiUrl);
  }

  create(item: ExcelLigneCalculee): Observable<ExcelLigneCalculee> {
    return this.http.post<ExcelLigneCalculee>(this.apiUrl, item);
  }
}
