import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'label'
})
export class LabelPipe implements PipeTransform {

  transform(value: string): string {
    if (value.match(/temperature/)) return value.replace(/temperature/g, String.fromCharCode(176) + 'C');
    if (value.match(/humidity/)) return value.replace(/humidity/g, '%');
    return value;
  }

}
