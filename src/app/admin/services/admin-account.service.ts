import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAccount } from './admin-account';

@Injectable({ providedIn: 'root' })
export class AdminAccountService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Admin`;

  getById(id: number): Observable<AdminAccount> {
    return this.http.get<AdminAccount>(`${this.apiUrl}/${id}`);
  }
}
