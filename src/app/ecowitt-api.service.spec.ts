import { TestBed } from '@angular/core/testing';

import { EcowittApiService } from './ecowitt-api.service';

describe('EcowittApiService', () => {
  let service: EcowittApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EcowittApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
