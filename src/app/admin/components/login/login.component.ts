import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService, AdminLoginRequest } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class AdminLoginComponent {

  credentials: AdminLoginRequest = { email: '', password: '' };
  showPassword = false;
  isSubmitting = false;
  loginError: string | null = null;

  constructor(
    private auth: AdminAuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.loginError = null;

    this.auth.login(this.credentials).subscribe({
      next: (admin) => {
        this.isSubmitting = false;
        const adminId = admin.id;

        if (adminId) {
          this.auth.saveSession(adminId);
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.loginError = 'Connexion réussie mais identifiant admin manquant.';
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.loginError = 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
      }
    });
  }
}
