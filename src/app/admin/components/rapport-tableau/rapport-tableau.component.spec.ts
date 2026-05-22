import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RapportTableauComponent } from './rapport-tableau.component';

describe('RapportTableauComponent', () => {
  let component: RapportTableauComponent;
  let fixture: ComponentFixture<RapportTableauComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RapportTableauComponent],
      imports: [
        ReactiveFormsModule,
        RouterTestingModule.withRoutes([
          {
            path: 'admin/societes/:id/rapports/:rapportId/tableau',
            component: RapportTableauComponent
          }
        ]),
        HttpClientTestingModule
      ]
    });
    fixture = TestBed.createComponent(RapportTableauComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
