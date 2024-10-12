import { Dayjs, OpUnitType, QUnitType } from 'dayjs';
import { Edges } from 'angular-resizable-element';
import { DragAxis } from 'angular-draggable-droppable/lib/draggable.directive';

export enum ViewMode {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER_YEAR = 'quarter_year',
  HALF_YEAR = 'half_year',
  YEAR = 'year',
}

export interface CalendarMainColumn {
  index: number;
  code: string;
  label: string;
  cols: Map<number, CalendarSubColumn>;
}

export interface CalendarSubColumn {
  col: number;
  label: string;
  viewMode: ViewMode;
  startDate: Dayjs;
  endDate: Dayjs;
  dates: Dayjs[];
}

export interface ViewModeConfig {
  cols: number;
  calendar: Map<number, CalendarMainColumn>;
  getMainIntType: (day: Dayjs) => number;
  getColIntType: (day: Dayjs) => number;
  startOfType: OpUnitType;
  addType: QUnitType;
  unitMultiplier: number;
}

export interface GridOptions {
  resize: { edges: Edges };
  drag: { axis: DragAxis };
  dimensions: GridDimensions;
  items: GridItemOptions;
}

export interface GridDimensions {
  rowHeight: number;
  colWidth: number;
  rows: number;
  cols: number;
}

export interface GridItemOptions {
  maxRows: number;
  maxCols: number;
  minRows: number;
  minCols: number;
  maxCount: number;
  defaultSize: ItemSize;
}

export interface GridSpace {
  id: string;
  coord: GridCoord;
  data: any;
  occupied: boolean;
}

export interface GridCoord {
  row: number;
  col: number;
}

export interface GridItem {
  id: any;
  pos: ItemPosition;
  style?: ItemStyle;
  content?: string;
}

export interface ItemStyle {
  position: string;
  top: string;
  left: string;
  height: string;
  width: string;
}

export interface ItemSize {
  rowspan: number;
  colspan: number;
}

export interface ItemPosition {
  coord: GridCoord;
  size: ItemSize;
}
