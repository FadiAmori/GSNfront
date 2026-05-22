import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RapportTableauImportComponent } from './rapport-tableau-import.component';

describe('RapportTableauImportComponent', () => {
  let component: RapportTableauImportComponent;
  let fixture: ComponentFixture<RapportTableauImportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RapportTableauImportComponent],
      imports: [FormsModule, RouterTestingModule, HttpClientTestingModule]
    });
    fixture = TestBed.createComponent(RapportTableauImportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
