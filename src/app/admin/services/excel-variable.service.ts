import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExcelVariable } from './excel-variable.model';

@Injectable({ providedIn: 'root' })
export class ExcelVariableService {

  private readonly apiUrl = `${environment.apiUrl}/ExcelVariable`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ExcelVariable[]> {
    return this.http.get<ExcelVariable[]>(this.apiUrl);
  }

  create(payload: ExcelVariable): Observable<ExcelVariable> {
    return this.http.post<ExcelVariable>(this.apiUrl, payload);
  }
  	update(id: number, payload: ExcelVariable): Observable<void> {
		return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
	}
}
