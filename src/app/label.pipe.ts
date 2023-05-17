import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'label'
})
export class LabelPipe implements PipeTransform {

  transform(value: string): string {
    if (value === 'temperature') return 'temp';
    return value;
  }

}
