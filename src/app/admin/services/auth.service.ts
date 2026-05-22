import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAccount } from './admin-account';
import { TokenService } from '../../societe/services/token.service';

export interface AdminLoginRequest {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Admin`;
  private readonly tokenService = inject(TokenService);

  login(credentials: AdminLoginRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      map((res) => {
        // backend may return { token, admin }
        if (res?.token) {
          this.tokenService.saveToken(res.token);
        }
        return res;
      })
    );
  }

  saveSession(adminId: number): void {
    sessionStorage.setItem('userType', 'admin');
    sessionStorage.setItem('adminId', String(adminId));
  }

  isLoggedIn(): boolean {
    return sessionStorage.getItem('userType') === 'admin';
  }

  logout(): void {
    sessionStorage.removeItem('userType');
    sessionStorage.removeItem('adminId');
  }
}
