import { AsyncPipe, KeyValuePipe, NgForOf, NgStyle } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarService } from '../calendar.service';
import { CalendarMainColumn, ViewMode } from 'src/app/grid.interface';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  standalone: true,
  imports: [NgForOf, NgStyle, KeyValuePipe, FormsModule, AsyncPipe],
})
export class CalendarComponent {
  constructor(public calendar: CalendarService) {
    this.calendar.viewMode$.subscribe((mode) => {
      console.log('view mode changed  - CAL');
    });
  }

  get calendarForMode(): Map<number, CalendarMainColumn> {
    if (this.calendar.getViewModeMap().has(this.calendar.getViewMode())) {
      return this.calendar.getCurrentViewModeMap()!.calendar;
    }
    return new Map();
  }

  get calendarHeight(): number {
    return this.calendar.calendarHeight;
  }
}
