import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocieteAuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']

})
export class ResetPasswordComponent implements OnInit {

  email!: string;
  newPassword = '';
  confirmPassword = '';

  constructor(
    private route: ActivatedRoute,
    private auth: SocieteAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email')!;
  }

  resetPassword(): void {

    if (this.newPassword !== this.confirmPassword) {
      alert("Les mots de passe ne correspondent pas");
      return;
    }

    this.auth.resetPassword(this.email, this.newPassword).subscribe({
      next: () => {
        alert("Mot de passe mis à jour !");
        this.router.navigate(['/societe/login']);
      },
      error: (error) => {
        alert(error?.error?.message || "Erreur lors du reset password");
      }
    });
  }

}