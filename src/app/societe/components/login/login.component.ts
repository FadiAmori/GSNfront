import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SocieteAuthService } from '../../services/auth.service';
import { Credentials } from '../../services/credentials';

@Component({
  selector: 'app-societe-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class SocieteLoginComponent {

  credentials: Credentials = { Email: '', Password: '' };
  rememberMe = false;
  isSubmitting = false;
  loginError: string | null = null;

  constructor(
    private auth: SocieteAuthService,
    private router: Router
  ) {}

onSubmit(): void {

  if (this.isSubmitting) {
    return;
  }

  this.isSubmitting = true;
  this.loginError = null;

  this.auth.login({
    Email: this.credentials.Email.trim(),
    Password: this.credentials.Password
  }).subscribe({

    next: (res: any) => {

      this.isSubmitting = false;

      // backend may return { token, user } or the societe object directly
      const societe = res?.user ?? res?.societe ?? res;

      // Vérification activation
      if (societe?.active === false) {
        this.loginError = "Votre compte n'est pas activé.";
        return;
      }

      const societeId = societe?.id ?? societe?.Id;

      if (societeId) {

        this.auth.saveSession(societeId);

        this.router.navigate([
          '/societe',
          'dashboard',
          societeId
        ]);

      } else {

        this.loginError =
          'Connexion réussie mais identifiant société manquant.';
      }
    },

    error: (error) => {

      this.isSubmitting = false;

      this.loginError =
        error?.error?.message ||
        error?.error?.title ||
        'Email ou mot de passe incorrect.';
    }
  });
}
forgotPassword(): void {
  if (!this.credentials.Email) {
    this.loginError = "Veuillez entrer votre email d'abord.";
    return;
  }

  this.auth.forgotPassword(this.credentials.Email.trim()).subscribe({
    next: () => {
      alert("Un email de réinitialisation a été envoyé.");
    },
    error: () => {
      this.loginError = "Erreur lors de l'envoi de l'email.";
    }
  });
}
}
