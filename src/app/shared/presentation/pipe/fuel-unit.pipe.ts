import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { unitKey } from '../../domain/model/fuel-unit';

@Pipe({ name: 'fuelUnit', standalone: true, pure: false })
export class FuelUnitPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  transform(unit: string | null | undefined): string { return this.translate.instant(unitKey(unit)); }
}
