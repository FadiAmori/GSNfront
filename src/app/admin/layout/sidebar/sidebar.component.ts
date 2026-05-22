import { Component } from '@angular/core';

export interface SidebarLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class AdminSidebarComponent {

  menuItems: SidebarLink[] = [
    { label: 'Tableau de bord', path: '/admin/dashboard' },
    { label: 'Sociétés', path: '/admin/societes' },
    { label: 'Rapports', path: '/admin/societes/1/rapports' },
  ];
}
