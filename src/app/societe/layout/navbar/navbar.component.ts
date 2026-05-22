import { Component, EventEmitter, Input, Output } from '@angular/core';
export interface SidebarLink {
  label: string;
  path: string;
}
@Component({
  selector: 'app-societe-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})

export class SocieteNavbarComponent {

  @Input() adminName = 'SOCIETE';
  @Output() logoutClick = new EventEmitter<void>();

  tabs = ['Accueil', 'Données', 'Rapports', 'Aide'];
  activeTab = 'Accueil';

  onLogout(): void {
    this.logoutClick.emit();
  }
    menuItems: SidebarLink[] = [
      { label: 'Tableau de bord', path: '/societe/dashboard' },
      { label: 'Liste Rapports', path: '/societe/budget-unitaire' },
      { label: 'CR', path: '/societe/rapport-cr' },
      { label: 'Rapport Tableau', path: '/societe/rapport-tableau' },
  
    ];
}
