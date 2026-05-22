import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AdminLayoutComponent } from './admin-layout.component';
import { AdminNavbarComponent } from '../navbar/navbar.component';
import { AdminSidebarComponent } from '../sidebar/sidebar.component';
import { AdminAuthService } from '../../services/auth.service';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdminLayoutComponent, AdminNavbarComponent, AdminSidebarComponent],
      imports: [RouterTestingModule, HttpClientTestingModule]
    });
    const auth = TestBed.inject(AdminAuthService);
    spyOn(auth, 'isLoggedIn').and.returnValue(true);

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
