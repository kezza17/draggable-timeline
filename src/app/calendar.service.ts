import { Injectable } from '@angular/core';
import dayjs, { Dayjs, OpUnitType, QUnitType } from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import quarter from 'dayjs/plugin/quarterOfYear';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { BehaviorSubject } from 'rxjs';
import {
  CalendarMainColumn,
  ViewMode,
  CalendarSubColumn,
  ViewModeConfig,
} from 'src/app/grid.interface';

dayjs.extend(weekday);
dayjs.extend(quarter);
dayjs.extend(weekOfYear);

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private viewMode = new BehaviorSubject<ViewMode>(ViewMode.WEEK);
  private viewModeMap = new BehaviorSubject<Map<ViewMode, ViewModeConfig>>(
    new Map<ViewMode, ViewModeConfig>()
  );

  pagesInBuffer = 0;
  mainColsPerPage = 5;
  mainColWidth = 200;

  calendarHeight = 100;

  today = dayjs();

  constructor() {
    this.initViewModeMap();
    this.setCalendarForMode(ViewMode.WEEK);
    this.setCalendarForMode(ViewMode.MONTH);
    this.setCalendarForMode(ViewMode.QUARTER_YEAR);
    this.setCalendarForMode(ViewMode.HALF_YEAR);
    this.setCalendarForMode(ViewMode.YEAR);

    const map = this.getViewModeMap();
    const objectMapped = this.mapMapToObject(map);
    const json = JSON.stringify(objectMapped, null, 2);
    console.log(json);
  }

  mapMapToObject(map: Map<ViewMode, ViewModeConfig>): Object {
    const obj = {};
    for (const [key, value] of map) {
      if (value instanceof Map) {
        // Recursively convert nested Map to Object
        //@ts-ignore
        obj[key] = this.mapMapToObject(value);
      } else if (typeof value === 'object' && value !== null) {
        // If the value is an object and not null, check if it contains any Map fields
        const newObj = {};
        for (const [fieldKey, fieldValue] of Object.entries(value)) {
          if (fieldValue instanceof Map) {
            //@ts-ignore
            newObj[fieldKey] = this.mapMapToObject(fieldValue);
          } else {
            //@ts-ignore
            newObj[fieldKey] = fieldValue;
          }
        }
        //@ts-ignore
        obj[key] = newObj;
      } else {
        //@ts-ignore
        // Directly assign primitive values
        obj[key] = value;
      }
    }
    return obj;
  }

  //
  getViewMode() {
    return this.viewMode.value;
  }

  setViewMode(mode: ViewMode) {
    console.log('View mode set', mode);
    this.viewMode.next(mode);
  }

  get viewMode$() {
    return this.viewMode.asObservable();
  }

  getViewModeMap() {
    return this.viewModeMap.value;
  }

  getViewModeMapValue(mode: ViewMode) {
    return this.viewModeMap.value.get(mode);
  }

  getCurrentViewModeMap(): ViewModeConfig | undefined {
    return this.viewModeMap.value.get(this.getViewMode());
  }

  setViewModeMap(map: Map<ViewMode, ViewModeConfig>) {
    this.viewModeMap.next(map);
  }

  //

  /*
  Populate ViewModeConfig map for each ViewMode with base fields before populating calendar field
   */
  initViewModeMap() {
    const map = this.viewModeMap.value;
    map.set(ViewMode.WEEK, {
      cols: 7,
      calendar: new Map<number, CalendarMainColumn>(),
      getMainIntType: (day: Dayjs) => {
        return this.weekOfMonth(day);
      },
      getColIntType: (day: Dayjs) => {
        return day.date();
      },
      //@ts-ignore
      startOfType: 'week',
      //@ts-ignore
      addType: 'weeks',
      unitMultiplier: 1,
    });
    map.set(ViewMode.MONTH, {
      cols: 4,
      calendar: new Map<number, CalendarMainColumn>(),
      getMainIntType: (day: Dayjs) => {
        return day.month();
      },
      getColIntType: (day: Dayjs) => {
        return this.weekOfMonth(day);
      },
      startOfType: 'month',
      addType: 'month',
      unitMultiplier: 1,
    });
    map.set(ViewMode.QUARTER_YEAR, {
      cols: 3,
      calendar: new Map<number, CalendarMainColumn>(),
      getMainIntType: (day: Dayjs) => {
        return day.quarter();
      },
      getColIntType: (day: Dayjs) => {
        return day.month();
      },
      //@ts-ignore
      startOfType: 'quarter',
      addType: 'quarters',
      unitMultiplier: 1,
    });
    map.set(ViewMode.HALF_YEAR, {
      cols: 6,
      calendar: new Map<number, CalendarMainColumn>(),
      getMainIntType: (day: Dayjs) => {
        return day.quarter() < 3 ? 1 : 2;
      },
      getColIntType: (day: Dayjs) => {
        return day.month();
      },
      //@ts-ignore
      startOfType: 'quarter',
      addType: 'quarters',
      unitMultiplier: 2,
    });
    map.set(ViewMode.YEAR, {
      cols: 12,
      calendar: new Map<number, CalendarMainColumn>(),
      getMainIntType: (day: Dayjs) => {
        return day.year();
      },
      getColIntType: (day: Dayjs) => {
        return day.month();
      },
      startOfType: 'year',
      addType: 'years',
      unitMultiplier: 1,
    });
    this.setViewModeMap(map);
  }

  /*
  Populates calendar in ViewModeConfig map for each ViewMode
  */
  setCalendarForMode(mode: ViewMode) {
    const viewModeConfig = this.getViewModeMapValue(mode)!;

    // Adds extra page to future buffer to include current page
    const colsInFutureBuffer =
      this.mainColsPerPage * viewModeConfig.unitMultiplier +
      this.pagesInBuffer * this.mainColsPerPage * viewModeConfig.unitMultiplier;
    const colsInPastBuffer =
      this.pagesInBuffer * this.mainColsPerPage * viewModeConfig.unitMultiplier;

    const dayZero = this.dayZero(mode);
    const futureEndDate = dayZero
      .add(colsInFutureBuffer, viewModeConfig.addType)
      .subtract(1, 'days');
    const pastEndDate = dayZero.subtract(
      colsInPastBuffer,
      viewModeConfig.addType
    );

    this.addFutureBuffer(mode, dayZero, futureEndDate);
    this.addPastBuffer(mode, dayZero, pastEndDate);
    this.setStartAndEndDates(mode);
  }

  /*
  Calculates first day of interval, ie first da of week, month, quarter based on current date (this.today)
   */
  dayZero(mode: ViewMode) {
    const viewModeConfig = this.getViewModeMapValue(mode)!;
    if (mode == ViewMode.HALF_YEAR) {
      const quarter =
        dayjs(this.today).quarter() == 2
          ? 1
          : dayjs(this.today).quarter() == 4
          ? 3
          : dayjs(this.today).quarter();

      return dayjs(this.today)
        .quarter(quarter)
        .startOf(viewModeConfig.startOfType);
    } else {
      return dayjs(this.today).startOf(viewModeConfig.startOfType);
    }
  }

  addFutureBuffer(mode: ViewMode, dayZero: Dayjs, futureEndDate: Dayjs) {
    let col = -1;
    let currInt = -999;

    const modeConfig = this.getViewModeMapValue(mode)!;
    // from dayZero, add one day until endDate is reached - since each date needs to be added to the col data
    for (
      let day = dayZero;
      !day.isAfter(futureEndDate);
      day = day.add(1, 'day')
    ) {
      // generate code based on ViewMode and date for each main col
      const mainColIndex = Math.floor((col + 1) / modeConfig.cols);
      const mainColCode = this.generateMainColCode(mode, day);
      const mainColLabel = this.generateMainColLabel(mode, day);

      // if map does not have mainColCode as key yet, add it
      if (!modeConfig.calendar.has(mainColIndex)) {
        modeConfig.calendar.set(mainColIndex, {
          index: mainColIndex,
          code: mainColCode,
          label: mainColLabel,
          cols: new Map<number, CalendarSubColumn>(),
        });
      }
      const currentMainCol = modeConfig.calendar.get(mainColIndex)!;

      // dayInt is which day of week, month, year etc it is
      // if it is a new dayInt, create a new column in cols, else push to existing
      const dayInt = modeConfig.getColIntType(day);
      if (dayInt != currInt) {
        col++;
        currInt = dayInt;
        currentMainCol.cols.set(col, {
          col: col,
          label: this.generateSubColLabel(mode, day),
          startDate: day,
          endDate: day,
          viewMode: mode,
          dates: [day],
        });
      } else {
        if (currentMainCol.cols.has(col)) {
          currentMainCol.cols.get(col)!.dates.push(day);
        }
      }
    }
  }

  addPastBuffer(mode: ViewMode, dayZero: Dayjs, pastEndDate: Dayjs) {
    let col = 0;
    let currInt = 999;

    const modeConfig = this.getViewModeMapValue(mode)!;
    for (
      let day = dayZero;
      !day.isBefore(pastEndDate);
      day = day.subtract(1, 'day')
    ) {
      const mainColIndex = Math.floor((col + 1) / modeConfig.cols);
      const mainColCode = this.generateMainColCode(mode, day);
      const mainColLabel = this.generateMainColLabel(mode, day);

      if (!modeConfig.calendar.has(mainColIndex)) {
        modeConfig.calendar.set(mainColIndex, {
          index: mainColIndex,
          code: mainColCode,
          label: mainColLabel,
          cols: new Map<number, CalendarSubColumn>(),
        });
      }

      const currentMainCol = modeConfig.calendar.get(mainColIndex)!;
      const dayInt = modeConfig.getColIntType(day);
      if (dayInt != currInt) {
        col++;
        currentMainCol.cols.set(col, {
          col: col,
          label: this.generateSubColLabel(mode, day),
          startDate: day,
          endDate: day,
          viewMode: mode,
          dates: [day],
        });
        currInt = dayInt;
      } else {
        currentMainCol.cols.get(col)!.dates.push(day);
      }
    }
  }

  setStartAndEndDates(mode: ViewMode) {
    for (const [key, value] of this.getViewModeMapValue(mode)!.calendar) {
      for (const [key1, value1] of value.cols) {
        const startDate = value1.dates.reduce((latest, current) =>
          current.isBefore(latest) ? current : latest
        );
        const endDate = value1.dates.reduce((latest, current) =>
          current.isAfter(latest) ? current : latest
        );
        value1.startDate = startDate;
        value1.endDate = endDate;
      }
    }
  }

  // todo could move into config with just id part
  generateMainColCode(mode: ViewMode, day: Dayjs) {
    switch (mode) {
      case ViewMode.WEEK:
        return `${mode}_${this.weekOfMonth(day)}_${day.month()}_${day.year()}`;
      case ViewMode.MONTH:
        return `${mode}_${day.month()}_${day.year()}`;
      case ViewMode.QUARTER_YEAR:
        return `${mode}_${day.quarter()}_${day.year()}`;
      case ViewMode.HALF_YEAR:
        return `${mode}_${day.quarter() < 3 ? 1 : 2}_${day.year()}`;
      case ViewMode.YEAR:
        return `${mode}_${day.year()}_${day.year()}`;
    }
  }

  generateMainColLabel(mode: ViewMode, day: Dayjs) {
    switch (mode) {
      case ViewMode.WEEK:
        return day.format('MMM YYYY');
      case ViewMode.MONTH:
        return day.format('MMM YYYY');
      case ViewMode.QUARTER_YEAR:
        return `Quarter ${day.quarter()} ${day.format('YYYY')}`;
      case ViewMode.HALF_YEAR:
        return `Half ${day.quarter() < 3 ? 1 : 2} ${day.format('YYYY')}`;
      case ViewMode.YEAR:
        return `${day.format('YYYY')}`;
    }
  }

  generateSubColLabel(mode: ViewMode, day: Dayjs) {
    switch (mode) {
      case ViewMode.WEEK:
        return day.format('D');
      case ViewMode.MONTH:
        return day.format('D');
      case ViewMode.QUARTER_YEAR:
        return day.format('MMM');
      case ViewMode.HALF_YEAR:
        return day.format('MMM');
      case ViewMode.YEAR:
        return day.format('MMM')[0];
    }
  }

  weekOfMonth(day: Dayjs) {
    const dayOfMonth = dayjs(day).date();
    const weekNumber = Math.min(Math.ceil(dayOfMonth / 7), 4);
    return weekNumber;
  }
}
