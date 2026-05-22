import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Credentials } from './credentials';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class SocieteAuthService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private tokenService: TokenService) {}

  login(credentials: Credentials): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Societe/login`, credentials).pipe(
      map((res) => {
        // Expect backend to return { token: '...', user: { ... } }
        if (res?.token) {
          this.tokenService.saveToken(res.token);
        }
        if (res?.user) {
          this.tokenService.saveUser(res.user);
        }
        return res;
      })
    );
  }

  saveSession(societeId: number): void {
    sessionStorage.setItem('userType', 'societe');
    sessionStorage.setItem('societeId', String(societeId));
  }

  logout(): void {
    this.tokenService.clear();
    sessionStorage.clear();
  }

  isLoggedIn(): boolean {
    return sessionStorage.getItem('userType') === 'societe';
  }
 
forgotPassword(email: string) {
  return this.http.post(`${this.apiUrl}/Societe/forgot-password`, { email });
}
resetPassword(email: string, newPassword: string) {
  return this.http.post(`${this.apiUrl}/Societe/reset-password`, {
    email,
    newPassword
  });
}
}
