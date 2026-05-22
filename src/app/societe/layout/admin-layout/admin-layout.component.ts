import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SocieteAuthService } from '../../services/auth.service';

@Component({
  selector: 'app-societe-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class SocieteLayoutComponent implements OnInit {

  adminName = 'Societe';
  statusMessage = 'Prêt';

  constructor(
    private auth: SocieteAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/societe/login']);
    }
  }

  onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/societe/login']);
  }
}
