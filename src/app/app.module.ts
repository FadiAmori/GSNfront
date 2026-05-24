import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './societe/services/auth.interceptor';

import { AppComponent } from './app.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Admin imports
import { AdminLoginComponent } from './admin/components/login/login.component';
import { AdminDashboardComponent } from './admin/components/dashboard/dashboard.component';
import { SocieteDashboardComponent as AdminSocieteDashboardComponent } from './admin/components/societe-dashboard/societe-dashboard.component';
import { AdminLayoutComponent } from './admin/layout/admin-layout/admin-layout.component';
import { AdminNavbarComponent } from './admin/layout/navbar/navbar.component';
import { AdminSidebarComponent } from './admin/layout/sidebar/sidebar.component';
import { SocietesListComponent } from './admin/components/societes-list/societes-list.component';
import { SocieteUsersComponent as AdminSocieteUsersComponent } from './admin/components/societe-users/societe-users.component';
import { SocieteRapportsComponent as AdminSocieteRapportsComponent } from './admin/components/societe-rapports/societe-rapports.component';
import { RapportTableauComponent } from './admin/components/rapport-tableau/rapport-tableau.component';
import { RapportTableauImportComponent } from './admin/components/rapport-tableau-import/rapport-tableau-import.component';
import { RapportCalculComponent as AdminRapportCalculComponent } from './admin/components/rapport-calcul/rapport-calcul.component';
import { RapportCrComponent as AdminRapportCrComponent } from './admin/components/rapport-cr/rapport-cr.component';
import { ClesDeRepartitionComponent as AdminClesDeRepartitionComponent } from './admin/components/cles-de-repartition/cles-de-repartition.component';
import { RapportProduitsComponent as AdminRapportProduitsComponent } from './admin/components/rapport-produits/rapport-produits.component';

// Societe imports
import { SocieteLoginComponent } from './societe/components/login/login.component';
import { SocieteDashboardComponent } from './societe/components/societe-dashboard/societe-dashboard.component';
import { SocieteUsersComponent } from './societe/components/societe-users/societe-users.component';
import { SocieteRapportsComponent } from './societe/components/societe-rapports/societe-rapports.component';
import { RapportCalculComponent } from './societe/components/rapport-calcul/rapport-calcul.component';
import { RapportCrComponent } from './societe/components/rapport-cr/rapport-cr.component';
import { RapportProduitsComponent } from './societe/components/rapport-produits/rapport-produits.component';
import { ClesDeRepartitionComponent } from './societe/components/cles-de-repartition/cles-de-repartition.component';
import { RapportTableauComponent as SocieteRapportTableauComponent } from './societe/components/rapport-tableau/rapport-tableau.component';
import { LineChartComponent } from './societe/components/line-chart/line-chart.component';
import { SocieteNavbarComponent } from './societe/layout/navbar/navbar.component';
import { SocieteSidebarComponent } from './societe/layout/sidebar/sidebar.component';
import { SocieteLayoutComponent } from './societe/layout/admin-layout/admin-layout.component';
import { RapportCrSelectorComponent } from './societe/components/rapport-cr-selector/rapport-cr-selector.component';
import { RapportTableauSelectorComponent } from './societe/components/rapport-tableau-selector/rapport-tableau-selector.component';
import { BudgetUnitaireComponent } from './societe/components/budget-unitaire/budget-unitaire.component';
import { ResetPasswordComponent } from './societe/components/reset-password/reset-password.component';

const routes: Routes = [
  { path: '', redirectTo: 'admin/login', pathMatch: 'full' },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'admin/login', component: AdminLoginComponent },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'societes/:id/cles-de-repartition', component: AdminClesDeRepartitionComponent },
      { path: 'societes/:id/utilisateurs', component: AdminSocieteUsersComponent },
      { path: 'societes/:id/dashboard', component: AdminSocieteDashboardComponent },
      {
        path: 'societes/:id/rapports/:rapportId/tableau',
        component: RapportTableauComponent
      },
      {
        path: 'societes/:id/rapports/:rapportId/calculs',
        component: AdminRapportCalculComponent
      },
      {
        path: 'societes/:id/rapports/:rapportId/rapport-cr',
        component: AdminRapportCrComponent
      },
      {
        path: 'societes/:id/rapports/:rapportId/rapport-produits',
        component: AdminRapportProduitsComponent
      },
      {
        path: 'societes/:id/rapports/:rapportId/import-excel',
        component: RapportTableauImportComponent
      },
      { path: 'societes/:id/rapports', component: AdminSocieteRapportsComponent },
        { path: 'societes/1/rapports', component: AdminSocieteRapportsComponent },

      { path: 'societes', component: SocietesListComponent },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },

  { path: 'societe/login', component: SocieteLoginComponent },

  {
    path: 'societe',
    component: SocieteLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard/:id', component: SocieteDashboardComponent },
      { path: 'dashboard', component: SocieteDashboardComponent },
      { path: 'cles-de-repartition', component: ClesDeRepartitionComponent },
      { path: 'rapport-calcul', component: RapportCalculComponent },
      { path: 'rapport-cr', component: RapportCrSelectorComponent },
      { path: 'rapport-cr/:rapportId', component: RapportCrComponent },
      { path: 'rapport-produits', component: RapportProduitsComponent },
      { path: 'rapport-tableau', component: RapportTableauSelectorComponent },
      { path: 'rapport-tableau/:rapportId', component: SocieteRapportTableauComponent },
      { path: 'budget-unitaire', component: BudgetUnitaireComponent },
      { path: 'societes/budget-unitaire', redirectTo: 'budget-unitaire', pathMatch: 'full' },
      { path: 'societe-rapports', component: SocieteRapportsComponent },
      { path: 'societe-users', component: SocieteUsersComponent },
      { path: 'line-chart', component: LineChartComponent },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },

  { path: 'dashboard', redirectTo: 'admin/dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    AppComponent,
    // Admin components
    AdminLoginComponent,
    AdminDashboardComponent,
    AdminLayoutComponent,
    AdminNavbarComponent,
    AdminSidebarComponent,
    SocietesListComponent,
    AdminSocieteUsersComponent,
    AdminSocieteRapportsComponent,
    // Societe components
    SocieteLoginComponent,
    SocieteUsersComponent,
    SocieteRapportsComponent,
    SocieteLayoutComponent,
    SocieteNavbarComponent,
    SocieteSidebarComponent,
    RapportCrSelectorComponent,
    RapportTableauSelectorComponent,
    ResetPasswordComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    DragDropModule,
    RapportTableauComponent,
    RapportTableauImportComponent,
    SocieteDashboardComponent,
    SocieteRapportTableauComponent,
    RapportCalculComponent,
    RapportCrComponent,
    RapportProduitsComponent,
    ClesDeRepartitionComponent,
    LineChartComponent,
    BudgetUnitaireComponent,
    RouterModule.forRoot(routes)
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
