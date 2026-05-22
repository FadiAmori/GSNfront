import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SocieteRapportsComponent } from './societe-rapports.component';

describe('SocieteRapportsComponent', () => {
  let component: SocieteRapportsComponent;
  let fixture: ComponentFixture<SocieteRapportsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SocieteRapportsComponent],
      imports: [ReactiveFormsModule, RouterTestingModule, HttpClientTestingModule]
    });
    fixture = TestBed.createComponent(SocieteRapportsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
