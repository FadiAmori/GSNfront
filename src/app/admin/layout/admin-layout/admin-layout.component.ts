import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {

  adminName = 'Administrateur';
  statusMessage = 'Prêt';

  constructor(
    private auth: AdminAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/admin/login']);
    }
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
