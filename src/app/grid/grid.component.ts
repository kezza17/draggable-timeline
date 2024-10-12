import { NgForOf, NgStyle } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BoundingRectangle,
  Edges,
  ResizableModule,
  ResizeEvent,
} from 'angular-resizable-element';
import {
  DragAndDropModule,
  DragEndEvent,
  DropEvent,
  ValidateDrag,
  ValidateDragParams,
} from 'angular-draggable-droppable';
import { v4 as uuid } from 'uuid';
import { SnapGrid } from 'angular-draggable-droppable/lib/draggable.directive';
import dayjs, { Dayjs } from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarter from 'dayjs/plugin/quarterOfYear';
import { CalendarComponent } from 'src/app/calendar/calendar.component';
import { CalendarService } from '../calendar.service';
import {
  CalendarSubColumn,
  CalendarMainColumn,
  GridCoord,
  GridItem,
  GridOptions,
  GridSpace,
  ItemSize,
  ItemPosition,
} from 'src/app/grid.interface';

dayjs.extend(weekday);
dayjs.extend(isoWeek);
dayjs.extend(quarter);

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrls: ['./grid.component.css'],
  standalone: true,
  imports: [
    NgForOf,
    ResizableModule,
    NgStyle,
    DragAndDropModule,
    FormsModule,
    CalendarComponent,
  ],
})
export class GridComponent {
  style: object = {};
  isResizing = false;
  startPos = { top: '0px', left: '0px' };

  grid: GridSpace[][] = [];
  gridItems: GridItem[] = [];

  gridOptions: GridOptions = {
    resize: {
      edges: {
        bottom: true,
        top: true,
        left: true,
        right: true,
      },
    },
    drag: {
      axis: {
        x: true,
        y: true,
      },
    },
    dimensions: {
      rows: 10,
      cols: 35,
      rowHeight: 50,
      colWidth: 30,
    },
    items: {
      maxCount: 10,
      maxRows: 1,
      minRows: 1,
      maxCols: 100,
      minCols: 1,
      defaultSize: {
        rowspan: 1,
        colspan: 4,
      },
    },
  };

  droppedData: string = '';
  activeItem: GridItem | null = null;

  previewItem: ItemPosition = {
    coord: {
      row: 0,
      col: 0,
    },
    size: {
      rowspan: 0,
      colspan: 0,
    },
  };

  constructor(private calendar: CalendarService) {
    this.calendar.viewMode$.subscribe((mode) => {
      console.log('view mode changed - GRID');
      this.calculateGridDimensions();

      this.gridItems.forEach((ea) => {
        ea.style = this.initStyle(ea);
      });
    });

    this.setGrid();
  }

  /// ********* GRID SETTING *********

  setGrid() {
    this.calculateGridDimensions();
    this.initGrid();
    this.initGridItems();
  }

  calculateGridDimensions() {
    const viewModeConfig = this.calendar.getCurrentViewModeMap()!;
    console.log(viewModeConfig, this.calendar);
    this.gridOptions.dimensions.cols =
      this.calendar.mainColsPerPage * viewModeConfig.cols;
    this.gridOptions.dimensions.colWidth =
      this.calendar.mainColWidth / viewModeConfig.cols;
  }

  initGrid() {
    this.grid = [];
    for (let i = 0; i < this.gridOptions.dimensions.cols; i++) {
      this.grid.push([]);
      for (let j = 0; j < this.gridOptions.dimensions.rows; j++) {
        this.grid[i].push({
          id: `${j}_${i}_space`,
          coord: {
            row: j,
            col: i,
          },
          data: null,
          occupied: false,
        });
      }
    }
  }

  initGridItems() {
    this.gridItems.push({
      id: uuid(),
      pos: {
        coord: { row: 0, col: 0 },
        size: { colspan: 2, rowspan: 1 },
      },
    });
    this.gridItems.push({
      id: uuid(),
      pos: {
        coord: { row: 1, col: 0 },
        size: { colspan: 4, rowspan: 1 },
      },
    });
    this.setOccupiedSpaces();

    this.gridItems.forEach((ea) => {
      ea.style = this.initStyle(ea);
    });
  }

  setOccupiedSpaces() {
    const itemPositions = this.gridItems.map((m) => m.pos);
    const coords = this.convertItemSizesToCoords(itemPositions);

    this.grid.forEach((row) => {
      row.forEach((space) => {
        const spaceCoord = { row: space.coord.row, col: space.coord.col };
        space.occupied = this.doesCoordOverlap(spaceCoord, coords);
      });
    });
  }

  onResizeStart(item: GridItem) {
    this.activeItem = item;
    this.isResizing = true;
  }

  onResizeEnd(event: ResizeEvent, item: GridItem): void {
    item.style = {
      position: 'absolute',
      left: `${event.rectangle.left}px`,
      top: `${event.rectangle.top - this.calHeight}px`,
      width: `${event.rectangle.width}px`,
      height: `${event.rectangle.height}px`,
    };

    item.pos = { ...this.convertRectangleToItemSize(event.rectangle) };
    this.setOccupiedSpaces();

    setTimeout(() => {
      this.isResizing = false;
    }, 100);
  }

  dragStart(item: GridItem) {
    this.activeItem = item;
    const top = item.style!.top ? item.style!.top : '0px';
    const left = item.style!.left ? item.style!.left : '0px';
    this.startPos = { top, left };
  }

  createNewItem(pos: ItemPosition) {
    if (this.exceedingGridItemCount()) {
      console.log('cannot add anymore items to grid');
      return;
    }

    const newItem: GridItem = {
      id: uuid(),
      pos: { ...pos },
      style: {
        position: 'absolute',
        top: pos.coord.row * this.gridOptions.dimensions.rowHeight + 'px',
        left: pos.coord.col * this.gridOptions.dimensions.colWidth + 'px',
        height: pos.size.rowspan * this.gridOptions.dimensions.rowHeight + 'px',
        width: pos.size.colspan * this.gridOptions.dimensions.colWidth + 'px',
      },
    };

    this.activeItem = null;

    if (this.validateDrop(pos)) {
      this.gridItems.push(newItem);
      this.setOccupiedSpaces();
    }

    this.previewItem.size.rowspan = 0;
  }

  removeItemFromGrid(gridItem: GridItem) {
    this.gridItems = this.gridItems.filter((f) => f.id != gridItem.id);
    this.setOccupiedSpaces();
  }

  setPreview(space: GridSpace) {
    this.spaceDates(space);
    console.log('setting preview');
    const initialSpace = { ...space };
    let hoverSpace: GridSpace = { ...space };

    this.previewItem = {
      coord: {
        row: hoverSpace.coord.row,
        col: hoverSpace.coord.col,
      },
      size: {
        rowspan: 1,
        colspan: 1,
      },
    };

    this.getDatesForSpace(space);

    const mouseMoveListener = (mouseMoveEvent: MouseEvent) => {
      const hoverId = (mouseMoveEvent.target as HTMLElement).id;
      if (hoverId) {
        hoverSpace =
          this.getGridSpaceFromId(hoverId) != null
            ? this.getGridSpaceFromId(hoverId)!
            : hoverSpace;

        const newRow =
          initialSpace.coord.row < hoverSpace.coord.row
            ? initialSpace.coord.row
            : hoverSpace.coord.row;
        const newCol =
          initialSpace.coord.col < hoverSpace.coord.col
            ? initialSpace.coord.col
            : hoverSpace.coord.col;
        const newRowspan =
          Math.abs(initialSpace.coord.row - hoverSpace.coord.row) + 1;
        const newColspan =
          Math.abs(initialSpace.coord.col - hoverSpace.coord.col) + 1;

        const restraints = this.gridOptions.items;

        this.previewItem = {
          coord: {
            row: newRow,
            col: newCol,
          },
          size: {
            rowspan:
              newRowspan > restraints.maxRows
                ? restraints.maxRows
                : newRowspan < restraints.minRows
                ? restraints.minRows
                : newRowspan,
            colspan:
              newColspan > restraints.maxCols
                ? restraints.maxCols
                : newColspan < restraints.minCols
                ? restraints.minCols
                : newColspan,
          },
        };
      }
    };

    const mouseUpListener = (mouseUpEvent: MouseEvent) => {
      if (
        this.previewItem.size.colspan == 1 &&
        this.previewItem.size.rowspan == 1
      ) {
        this.previewItem.size.rowspan =
          this.gridOptions.items.defaultSize.rowspan;
        this.previewItem.size.colspan =
          this.gridOptions.items.defaultSize.colspan;
      }
      this.createNewItem(this.previewItem);
      document.removeEventListener('mouseup', mouseUpListener);
      document.removeEventListener('mousemove', mouseMoveListener);
    };

    document.addEventListener('mouseup', mouseUpListener);
    document.addEventListener('mousemove', mouseMoveListener);
  }

  getDatesForSpace(space: GridSpace) {
    const currentCalendar: Map<number, CalendarMainColumn> =
      this.calendar.getCurrentViewModeMap()!.calendar;
    console.log(currentCalendar);
    console.log(space);

    for (let [key, value] of currentCalendar) {
      const cols: Map<number, CalendarSubColumn> = value.cols;
      for (let [colKey, colValue] of cols) {
        if (colValue.col == space.coord.col) {
          console.log('matching col', colValue.col, colValue.dates);
        }
      }
    }
  }

  getGridSpaceFromId(id: string): GridSpace | null {
    for (let row of this.grid) {
      for (let space of row) {
        if (id == space.id) return space;
      }
    }
    return null;
  }

  dragEnd(event: DragEndEvent, item: GridItem) {
    if (!this.isResizing) {
      const newTop = Number(this.startPos.top.replace('px', '')) + event.y;
      const newLeft = Number(this.startPos.left.replace('px', '')) + event.x;
      const newRow = Math.round(newTop / this.gridOptions.dimensions.rowHeight);
      const newCol = Math.round(newLeft / this.gridOptions.dimensions.colWidth);

      const newItemPos = {
        coord: {
          row: newRow,
          col: newCol,
        },
        size: {
          rowspan: item.pos.size.rowspan,
          colspan: item.pos.size.colspan,
        },
      };

      if (this.validateDrop(newItemPos)) {
        item.style!.top = newTop + 'px';
        item.style!.left = newLeft + 'px';
        item.pos.coord.row = newRow;
        item.pos.coord.col = newCol;
        this.setOccupiedSpaces();
      }
    }
  }

  onDrop(event: DropEvent): void {}

  initStyle(gridItem: GridItem) {
    return {
      position: 'absolute',
      top:
        gridItem.pos.coord.row * this.gridOptions.dimensions.rowHeight + 'px',
      left:
        gridItem.pos.coord.col * this.gridOptions.dimensions.colWidth + 'px',
      height:
        gridItem.pos.size.rowspan * this.gridOptions.dimensions.rowHeight +
        'px',
      width:
        gridItem.pos.size.colspan * this.gridOptions.dimensions.colWidth + 'px',
    };
  }

  validateResize = (event: ResizeEvent) => {
    const itemPos = this.convertRectangleToItemSize(event.rectangle);

    if (this.exceedingGridItemSize(itemPos.size))
      console.log('Size of item too large!');
    return (
      !this.isOverlapping(itemPos) &&
      !this.outsideOfGrid(itemPos) &&
      !this.exceedingGridItemSize(itemPos.size)
    );
  };

  validateDrag: ValidateDrag = (event: ValidateDragParams) => {
    // Can pick up item or not!!
    return true;
  };

  validateDrop(itemPos: ItemPosition) {
    return !this.isOverlapping(itemPos) && !this.outsideOfGrid(itemPos);
  }

  isOverlapping(itemPos: ItemPosition) {
    let itemCoords = this.convertItemSizesToCoords([itemPos]);

    let originalItemCoords: GridCoord[] = [];

    if (this.activeItem) {
      originalItemCoords = [
        ...this.convertItemSizesToCoords([this.activeItem.pos]),
      ];
    }

    itemCoords = itemCoords.filter(
      (f) => !this.doesCoordOverlap(f, originalItemCoords)
    );

    const occupiedGridCoords = this.grid
      .flatMap((fm) => fm)
      .filter((f) => f.occupied)
      .map((m) => {
        return { ...m.coord };
      });

    return this.doCoordsOverlap(itemCoords, occupiedGridCoords);
  }

  convertItemSizesToCoords(itemPositions: ItemPosition[]) {
    const coords: GridCoord[] = [];
    itemPositions.forEach((item) => {
      for (
        let i = item.coord.row;
        i < item.coord.row + item.size.rowspan;
        i++
      ) {
        for (
          let j = item.coord.col;
          j < item.coord.col + item.size.colspan;
          j++
        ) {
          coords.push({ row: i, col: j });
        }
      }
    });
    return coords;
  }

  doesCoordOverlap(spaceCoord: GridCoord, coords: GridCoord[]) {
    for (let coord of coords) {
      if (spaceCoord.row === coord.row && spaceCoord.col === coord.col) {
        return true;
      }
    }
    return false;
  }

  doCoordsOverlap(coords1: GridCoord[], coords2: GridCoord[]) {
    for (let coord1 of coords1) {
      for (let coord2 of coords2) {
        if (coord1.row === coord2.row && coord1.col === coord2.col) {
          console.log('coords overlap!');
          return true;
        }
      }
    }
    return false;
  }

  convertRectangleToItemSize(rectangle: BoundingRectangle): ItemPosition {
    return {
      coord: {
        row: Math.round(
          (rectangle.top - this.calHeight) /
            this.gridOptions.dimensions.rowHeight
        ),
        col: Math.round(rectangle.left / this.gridOptions.dimensions.colWidth),
      },
      size: {
        colspan: rectangle.width! / this.gridOptions.dimensions.colWidth,
        rowspan: rectangle.height! / this.gridOptions.dimensions.rowHeight,
      },
    };
  }

  outsideOfGrid(itemPos: ItemPosition) {
    const itemCoords = this.convertItemSizesToCoords([itemPos]);
    for (let coord of itemCoords) {
      if (
        coord.row > this.gridOptions.dimensions.rows - 1 ||
        coord.row < 0 ||
        coord.col > this.gridOptions.dimensions.cols - 1 ||
        coord.col < 0
      ) {
        console.log('you cant drop this outside of the grid');
        return true;
      }
    }
    return false;
  }

  exceedingGridItemSize(itemSize: ItemSize) {
    const itemOptions = this.gridOptions.items;
    return (
      itemSize.rowspan > itemOptions.maxRows ||
      itemSize.rowspan < itemOptions.minRows ||
      itemSize.colspan > itemOptions.maxCols ||
      itemSize.colspan < itemOptions.minCols
    );
  }

  exceedingGridItemCount() {
    return this.gridItems.length == this.gridOptions.items.maxCount;
  }

  spaceDates(space: GridSpace) {
    const currentConfig = this.calendar.getCurrentViewModeMap()!;
    const spaceMainCol = Math.floor(space.coord.col / currentConfig.cols);

    console.log(
      'col for space',
      currentConfig.calendar.get(spaceMainCol)!.cols.get(space.coord.col)
    );
    return currentConfig.calendar.get(spaceMainCol);
  }

  get dragSnapGrid(): SnapGrid {
    return {
      x: this.gridOptions.dimensions.colWidth,
      y: this.gridOptions.dimensions.rowHeight,
    };
  }

  get resizeSnapGrid(): Edges {
    return {
      left: this.gridOptions.dimensions.colWidth,
      right: this.gridOptions.dimensions.colWidth,
      top: this.gridOptions.dimensions.rowHeight,
      bottom: this.gridOptions.dimensions.rowHeight,
    };
  }

  get calHeight(): number {
    return this.calendar.calendarHeight;
  }

  inOtherColumn(col: number) {
    const rangeIndex = Math.floor(
      col / this.calendar.getCurrentViewModeMap()!.cols
    );
    return rangeIndex % 2 === 1;
  }
}
