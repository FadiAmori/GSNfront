import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class AdminNavbarComponent {

  @Input() adminName = 'Administrateur';
  @Output() logoutClick = new EventEmitter<void>();

  tabs = ['Accueil', 'Données', 'Rapports', 'Aide'];
  activeTab = 'Accueil';

  onLogout(): void {
    this.logoutClick.emit();
  }
}
