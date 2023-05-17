import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'label'
})
export class LabelPipe implements PipeTransform {

  transform(value: string, label?:string): string {
    if (label) {
      if (label.match(/temperature/)) return value + String.fromCharCode(176) + 'C';
      if (label.match(/humidity/)) return value+'%';
      if (label.match(/daily/)) return value+' mm';
      if (label.match(/rate/)) return value+' mm/h';
      if (label.match(/moisture/)) return value+'%';
      return value;
    } else {
      if (value.match(/temperature/)) return value.replace(/temperature/g, '');
      if (value.match(/humidity/)) return value.replace(/humidity/g, '');
      //if (value.match(/temperature/)) return value.replace(/temperature/g, String.fromCharCode(176) + 'C');
      //if (value.match(/humidity/)) return value.replace(/humidity/g, '%');
      return value;
    }
  }

}
