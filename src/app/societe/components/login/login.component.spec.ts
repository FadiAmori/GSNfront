import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SocieteLoginComponent } from './login.component';

describe('SocieteLoginComponent', () => {
  let component: SocieteLoginComponent;
  let fixture: ComponentFixture<SocieteLoginComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SocieteLoginComponent],
      imports: [FormsModule, RouterTestingModule, HttpClientTestingModule]
    });
    fixture = TestBed.createComponent(SocieteLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
