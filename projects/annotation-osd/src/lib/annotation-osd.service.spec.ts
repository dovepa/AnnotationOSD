import { TestBed } from '@angular/core/testing';

import { AnnotationOSDService } from './annotation-osd.service';

describe('AnnotationOSDService', () => {
  let service: AnnotationOSDService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnnotationOSDService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
