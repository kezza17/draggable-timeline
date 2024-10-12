import { Component } from '@angular/core';
import { CalendarComponent } from '../calendar/calendar.component';
import { GridComponent } from '../grid/grid.component';
import { ViewMode } from '../grid.interface';
import { CalendarService } from '../calendar.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.css'],
  standalone: true,
  imports: [CalendarComponent, GridComponent, FormsModule],
})
export class TimelineComponent {
  viewMode: ViewMode;

  constructor(public calendar: CalendarService) {
    this.calendar.viewMode$.subscribe((mode) => {
      console.log('view mode changed  - TIMELINE');
      this.viewMode = this.calendar.getViewMode();
    });
  }

  viewModeChanges(mode: any) {
    console.log(mode);
    this.calendar.setViewMode(mode);
  }
}
