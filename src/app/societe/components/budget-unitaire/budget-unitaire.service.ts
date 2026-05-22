import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BudgetUnitaireService {
  private readonly http = inject(HttpClient);
  private readonly importUrl = `${environment.apiUrl}/BudgetUnitaire/import`;

  importExcel(societeId: number, rapportId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('societeId', String(societeId));
    formData.append('rapportId', String(rapportId));
    formData.append('file', file);

    return this.http.post<void>(this.importUrl, formData);
  }
}
