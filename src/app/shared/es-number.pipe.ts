import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'esNumber' })
export class EsNumberPipe implements PipeTransform {
  transform(value: number): string {
    return value.toLocaleString('es-ES');
  }
}
