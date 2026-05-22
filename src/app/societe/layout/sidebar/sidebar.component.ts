import { Component } from '@angular/core';

export interface SidebarLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-societe-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SocieteSidebarComponent {

  menuItems: SidebarLink[] = [
    { label: 'Tableau de bord', path: '/societe/dashboard' },
    { label: 'Liste Rapports', path: '/societe/societe-rapports' },
    { label: 'CR', path: '/societe/rapport-cr' },
    { label: 'Rapport Tableau', path: '/societe/rapport-tableau' },
    { label: 'budget', path: '/societe/budget-unitaire' }

  ];
}
