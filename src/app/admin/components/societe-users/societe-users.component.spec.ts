import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SocieteUsersComponent } from './societe-users.component';

describe('SocieteUsersComponent', () => {
  let component: SocieteUsersComponent;
  let fixture: ComponentFixture<SocieteUsersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SocieteUsersComponent],
      imports: [
        ReactiveFormsModule,
        RouterTestingModule.withRoutes([
          { path: 'admin/societes/:id/utilisateurs', component: SocieteUsersComponent }
        ]),
        HttpClientTestingModule
      ]
    });
    fixture = TestBed.createComponent(SocieteUsersComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
