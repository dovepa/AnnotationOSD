import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationOSDComponent } from './annotation-osd.component';

describe('AnnotationOSDComponent', () => {
  let component: AnnotationOSDComponent;
  let fixture: ComponentFixture<AnnotationOSDComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AnnotationOSDComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnnotationOSDComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
