import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SocietesListComponent } from './societes-list.component';

describe('SocietesListComponent', () => {
  let component: SocietesListComponent;
  let fixture: ComponentFixture<SocietesListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SocietesListComponent],
      imports: [ReactiveFormsModule, RouterTestingModule, HttpClientTestingModule]
    });
    fixture = TestBed.createComponent(SocietesListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
