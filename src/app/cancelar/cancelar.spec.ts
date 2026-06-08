import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cancelar } from './cancelar';

describe('Cancelar', () => {
  let component: Cancelar;
  let fixture: ComponentFixture<Cancelar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cancelar],
    }).compileComponents();

    fixture = TestBed.createComponent(Cancelar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
