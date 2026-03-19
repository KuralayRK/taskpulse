import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Task, Direction, Product } from '../types';

const laneColors = [
  { bar: '#a78bfa', barLight: '#ede9fe', label: 'bg-purple-100 text-purple-700' },
  { bar: '#38bdf8', barLight: '#e0f2fe', label: 'bg-sky-100 text-sky-700' },
  { bar: '#fbbf24', barLight: '#fef3c7', label: 'bg-amber-100 text-amber-700' },
  { bar: '#fb7185', barLight: '#ffe4e6', label: 'bg-rose-100 text-rose-700' },
  { bar: '#2dd4bf', barLight: '#ccfbf1', label: 'bg-teal-100 text-teal-700' },
  { bar: '#818cf8', barLight: '#e0e7ff', label: 'bg-indigo-100 text-indigo-700' },
];
const noColor = { bar: '#9ca3af', barLight: '#f3f4f6', label: 'bg-gray-100 text-gray-500' };

const BAR_H = 26;
const ROW_GAP = 4;
const LANE_PAD = 8;
const LABEL_W = 110;
const WEEK_W_MOBILE = 120;
const WEEK_W_DESKTOP = 72;
const SUMMARY_H = 36;
const MIN_CHIP_W = 52;

const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const statusLabel: Record<string, string> = { todo: 'Не начато', in_progress: 'В работе', done: 'Готово' };
const statusDot: Record<string, string> = { todo: 'bg-gray-300', in_progress: 'bg-blue-500', done: 'bg-emerald-500' };

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function daysBetween(a: Date, b: Date): number {
  const a0 = new Date(a); a0.setHours(0, 0, 0, 0);
  const b0 = new Date(b); b0.setHours(0, 0, 0, 0);
  return Math.round((b0.getTime() - a0.getTime()) / 86400000);
}

function getMonday(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() + ((day === 0 ? -6 : 1) - day));
  return r;
}

function friendlyDeadline(deadline: string | null): string {
  if (!deadline) return 'без срока';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline); dl.setHours(0, 0, 0, 0);
  const days = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
  if (days < -1) return `${Math.abs(days)} дн. назад`;
  if (days === -1) return 'вчера';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days <= 7) return `через ${days} дн.`;
  return dl.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getTaskStart(t: Task): Date {
  return t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
}
function getTaskEnd(t: Task): Date {
  return t.deadline ? new Date(t.deadline) : addDays(getTaskStart(t), 7);
}

interface Week { start: Date; end: Date; label: string; month: number; year: number }
interface Lane { id: number | null; name: string; color: typeof laneColors[0]; tasks: Task[] }
interface BarPos { task: Task; left: number; width: number; row: number }

function computeRows(bars: { left: number; width: number }[]): number[] {
  const rows: number[] = [];
  const rowEnds: number[] = [];
  for (const { left, width } of bars) {
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (left >= rowEnds[r] + 4) {
        rowEnds[r] = left + width;
        rows.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) { rows.push(rowEnds.length); rowEnds.push(left + width); }
  }
  return rows;
}

function laneHeight(bars: BarPos[]): number {
  const maxRow = bars.length > 0 ? Math.max(...bars.map((b) => b.row)) : 0;
  return (maxRow + 1) * (BAR_H + ROW_GAP) + LANE_PAD * 2;
}

function taskUrl(id: number): string {
  const b = import.meta.env.BASE_URL ?? '/';
  const prefix = b === '/' ? '' : b.replace(/\/$/, '');
  return `${window.location.origin}${prefix}/tasks/${id}`;
}

interface TitlePopoverState {
  taskId: number;
  title: string;
  tasks?: Task[];
  left: number;
  top: number;
  maxWidth: number;
}

function measurePopover(anchor: HTMLElement, estH = 48): { left: number; top: number; maxWidth: number } {
  const r = anchor.getBoundingClientRect();
  const maxWidth = Math.min(320, window.innerWidth - 16);
  let left = r.left;
  if (left + maxWidth > window.innerWidth - 8) left = window.innerWidth - maxWidth - 8;
  left = Math.max(8, left);
  let top = r.bottom + 8;
  if (top + estH > window.innerHeight - 8) top = Math.max(8, r.top - estH - 8);
  return { left, top, maxWidth };
}

function measureTitlePopover(task: Task, anchor: HTMLElement): TitlePopoverState {
  const pos = measurePopover(anchor);
  return { taskId: task.id, title: task.title, ...pos };
}

function measureGroupPopover(tasks: Task[], anchor: HTMLElement): TitlePopoverState {
  const pos = measurePopover(anchor, tasks.length * 36 + 16);
  return { taskId: tasks[0].id, title: '', tasks, ...pos };
}

/** Группа пересекающихся чипов */
interface ChipGroup {
  tasks: Task[];
  left: number;
  width: number;
}

function groupOverlappingChips(chips: { task: Task; left: number; width: number }[]): ChipGroup[] {
  if (chips.length === 0) return [];
  const sorted = [...chips].sort((a, b) => a.left - b.left);
  const groups: ChipGroup[] = [];
  let cur: ChipGroup = { tasks: [sorted[0].task], left: sorted[0].left, width: sorted[0].width };

  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    const curRight = cur.left + cur.width;
    if (c.left < curRight - 2) {
      cur.tasks.push(c.task);
      cur.width = Math.max(cur.width, c.left + c.width - cur.left);
    } else {
      groups.push(cur);
      cur = { tasks: [c.task], left: c.left, width: c.width };
    }
  }
  groups.push(cur);
  return groups;
}

/** Сводные чипы на одной линии + коннектор + стопки для пересечений */
function SummaryTimeline({
  tasks,
  timelineStart,
  weekW,
  laneColor,
  openTitlePopover,
  openGroupPopover,
  onDragStart,
  dragState,
}: {
  tasks: Task[];
  timelineStart: Date;
  weekW: number;
  laneColor: typeof laneColors[0];
  openTitlePopover: (task: Task, anchor: HTMLElement) => void;
  openGroupPopover: (tasks: Task[], anchor: HTMLElement) => void;
  onDragStart: (taskId: number, mode: DragMode, e: React.PointerEvent, barLeft: number, barWidth: number) => void;
  dragState: DragState | null;
}) {
  const sorted = [...tasks].sort((a, b) => getTaskStart(a).getTime() - getTaskStart(b).getTime());
  const chips = sorted.map((task) => {
    const s = getTaskStart(task); s.setHours(0, 0, 0, 0);
    const e = getTaskEnd(task); e.setHours(0, 0, 0, 0);
    const left = (daysBetween(timelineStart, s) / 7) * weekW;
    const w = Math.max((Math.max(daysBetween(s, e), 1) / 7) * weekW, MIN_CHIP_W);
    return { task, left, width: w };
  });

  const groups = groupOverlappingChips(chips);

  let lineLeft = 0;
  let lineRight = 0;
  if (chips.length > 0) {
    lineLeft = Math.min(...chips.map((c) => c.left));
    lineRight = Math.max(...chips.map((c) => c.left + c.width));
  }

  const chipTop = (SUMMARY_H - BAR_H) / 2;

  return (
    <div className="absolute inset-0" style={{ height: SUMMARY_H }}>
      {chips.length > 1 && lineRight > lineLeft && (
        <div
          className="absolute rounded-full z-[1]"
          style={{
            left: lineLeft + 8,
            width: Math.max(lineRight - lineLeft - 16, 0),
            top: SUMMARY_H / 2 - 1,
            height: 3,
            backgroundColor: laneColor.bar,
            opacity: 0.55,
          }}
        />
      )}
      {groups.map((group) => {
        const topTask = group.tasks[0];
        const isStack = group.tasks.length > 1;
        const stackCount = group.tasks.length;

        if (!isStack) {
          return (
            <div key={topTask.id} className="absolute z-[3]" style={{ top: chipTop }}>
              <InteractiveBar
                task={topTask}
                left={chips.find((c) => c.task.id === topTask.id)!.left}
                width={chips.find((c) => c.task.id === topTask.id)!.width}
                topPx={0}
                laneColor={laneColor}
                openTitlePopover={openTitlePopover}
                onDragStart={onDragStart}
                dragState={dragState}
              />
            </div>
          );
        }

        const isDone = topTask.status === 'done';
        const isOverdue = topTask.deadline && new Date(topTask.deadline) < new Date() && !isDone;

        return (
          <div key={topTask.id} className="absolute z-[3]" style={{ left: group.left, width: group.width, top: chipTop, height: BAR_H }}>
            {isStack && stackCount >= 3 && (
              <div
                className="absolute rounded-md border border-white/20"
                style={{ left: 4, right: -4, top: 6, bottom: -6, backgroundColor: laneColor.bar, opacity: 0.25 }}
              />
            )}
            {isStack && (
              <div
                className="absolute rounded-md border border-white/20"
                style={{ left: 2, right: -2, top: 3, bottom: -3, backgroundColor: laneColor.bar, opacity: 0.35 }}
              />
            )}

            <button
              type="button"
              data-roadmap-title-trigger
              title={`${stackCount} задач(и)`}
              className="w-full h-full rounded-md overflow-hidden text-left border border-white/30 shadow-sm cursor-pointer pointer-events-auto relative"
              style={{
                backgroundColor: isDone ? laneColor.barLight : isOverdue ? '#fecaca' : laneColor.bar,
                opacity: isDone ? 0.65 : 1,
              }}
              onClick={(e) => { e.stopPropagation(); openGroupPopover(group.tasks, e.currentTarget); }}
            >
              <span className={`block px-1.5 py-0.5 text-[9px] font-semibold leading-tight truncate ${isDone ? 'text-gray-500 line-through' : isOverdue ? 'text-red-800' : 'text-white'}`}>
                {topTask.title}
              </span>
            </button>

            {isStack && (
              <span className="absolute -top-2 -right-2 z-[5] min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-md border-2 border-white pointer-events-none">
                {stackCount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type DragMode = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  taskId: number;
  mode: DragMode;
  startX: number;
  startY: number;
  origLeft: number;
  origWidth: number;
  origLaneId: number | null;
  deltaX: number;
  targetLaneId: number | null;
}

const HANDLE_W = 7;
const MIN_BAR_W = 20;
let _lastDragEnd = 0;

/** Интерактивная полоса задачи — перемещение и ресайз */
function InteractiveBar({
  task,
  left,
  width,
  topPx,
  laneColor,
  openTitlePopover,
  onDragStart,
  dragState,
}: {
  task: Task;
  left: number;
  width: number;
  topPx: number;
  laneColor: typeof laneColors[0];
  openTitlePopover: (task: Task, anchor: HTMLElement) => void;
  onDragStart: (taskId: number, mode: DragMode, e: React.PointerEvent, barLeft: number, barWidth: number) => void;
  dragState: DragState | null;
}) {
  const isDone = task.status === 'done';
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isDone;
  const isDragging = dragState?.taskId === task.id;

  let displayLeft = left;
  let displayWidth = width;
  if (isDragging && dragState) {
    if (dragState.mode === 'move') {
      displayLeft = dragState.origLeft + dragState.deltaX;
      displayWidth = dragState.origWidth;
    } else if (dragState.mode === 'resize-left') {
      const newLeft = dragState.origLeft + dragState.deltaX;
      const newWidth = dragState.origWidth - dragState.deltaX;
      if (newWidth >= MIN_BAR_W) { displayLeft = newLeft; displayWidth = newWidth; }
    } else if (dragState.mode === 'resize-right') {
      displayWidth = Math.max(MIN_BAR_W, dragState.origWidth + dragState.deltaX);
    }
  }

  const bg = isDone ? laneColor.barLight : isOverdue ? '#fecaca' : laneColor.bar;

  return (
    <div
      className={`absolute z-[4] group ${isDragging ? 'z-[10] opacity-80' : ''}`}
      style={{ left: displayLeft, width: displayWidth, top: topPx, height: BAR_H, touchAction: 'none' }}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 cursor-col-resize z-[6] flex items-center"
        style={{ width: HANDLE_W, touchAction: 'none' }}
        onPointerDown={(e) => { e.stopPropagation(); onDragStart(task.id, 'resize-left', e, left, width); }}
      >
        <div className="w-1 h-3 rounded-full bg-white/60 mx-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Main bar body — move */}
      <button
        type="button"
        data-roadmap-title-trigger
        title={task.title}
        className="absolute inset-0 rounded-md overflow-hidden text-left border border-white/20 cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: bg, opacity: isDone ? 0.5 : 1, left: HANDLE_W, right: HANDLE_W, width: 'auto', touchAction: 'none' }}
        onPointerDown={(e) => { e.stopPropagation(); onDragStart(task.id, 'move', e, left, width); }}
        onClick={(e) => {
          if (Date.now() - _lastDragEnd < 200) return;
          e.stopPropagation();
          openTitlePopover(task, e.currentTarget);
        }}
        onDoubleClick={(e) => {
          if (Date.now() - _lastDragEnd < 200) return;
          e.preventDefault();
          e.stopPropagation();
          window.open(taskUrl(task.id), '_blank', 'noopener,noreferrer');
        }}
      >
        <div className="h-full flex items-center px-2 overflow-hidden">
          <span className={`text-[10px] font-semibold truncate ${isDone ? 'text-gray-400 line-through' : isOverdue ? 'text-red-700' : 'text-white'}`}>
            {task.title}
          </span>
        </div>
      </button>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 cursor-col-resize z-[6] flex items-center"
        style={{ width: HANDLE_W }}
        onPointerDown={(e) => { e.stopPropagation(); onDragStart(task.id, 'resize-right', e, left, width); }}
      >
        <div className="w-1 h-3 rounded-full bg-white/60 mx-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLane, setExpandedLane] = useState<number | string | null>(null);
  const [titlePopover, setTitlePopover] = useState<TitlePopoverState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ignoreNextTimelineScroll = useRef(false);
  const [filterNames, setFilterNames] = useState<string[]>([]);
  const [filterDirs, setFilterDirs] = useState<number[]>([]);
  const [filterProducts, setFilterProducts] = useState<number[]>([]);
  const [filterNoDirection, setFilterNoDirection] = useState(false);
  const [filterNoProduct, setFilterNoProduct] = useState(false);
  const [filterNoAssignee, setFilterNoAssignee] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [highlightLaneId, setHighlightLaneId] = useState<number | null | undefined>(undefined);
  const laneRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const fn = () => setIsWide(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const weekW = isWide ? WEEK_W_DESKTOP : WEEK_W_MOBILE;

  const loadData = () => {
    Promise.all([api.getTasks(), api.getDirections(), api.getProducts()]).then(([t, d, p]) => {
      setTasks(t); setDirections(d); setAllProducts(p); setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    window.addEventListener('taskCreated', loadData);
    return () => window.removeEventListener('taskCreated', loadData);
  }, []);

  const openTitlePopover = (task: Task, anchor: HTMLElement) => {
    const anchorEl = anchor;
    const t = task;
    window.setTimeout(() => {
      setTitlePopover((cur) => {
        if (cur?.taskId === t.id && !cur.tasks) return null;
        return measureTitlePopover(t, anchorEl);
      });
    }, 0);
  };

  const openGroupPopover = (groupTasks: Task[], anchor: HTMLElement) => {
    const anchorEl = anchor;
    window.setTimeout(() => {
      setTitlePopover((cur) => {
        if (cur?.tasks && cur.taskId === groupTasks[0].id) return null;
        return measureGroupPopover(groupTasks, anchorEl);
      });
    }, 0);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest) return;
      if (el.closest('[data-roadmap-title-trigger]')) return;
      if (el.closest('[data-roadmap-title-popover]')) return;
      setTitlePopover(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  /* ── Drag logic ───────────────────────────────────────────── */
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean; origLeft: number; origWidth: number; taskId: number; mode: DragMode; origLaneId: number | null } | null>(null);

  const pixelToDate = useCallback((px: number, tsStart: Date, ww: number): Date => {
    const days = (px / ww) * 7;
    return addDays(tsStart, Math.round(days));
  }, []);

  const findLaneAtY = useCallback((clientY: number): number | null | undefined => {
    for (const [key, el] of laneRowRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return key === 'none' ? null : Number(key);
      }
    }
    return undefined;
  }, []);

  const handleDragStart = useCallback((taskId: number, mode: DragMode, e: React.PointerEvent, barLeft: number, barWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setTitlePopover(null);
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, origLeft: barLeft, origWidth: barWidth, taskId, mode, origLaneId: task.directionId ?? null };
    setDragState({
      taskId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: barLeft,
      origWidth: barWidth,
      origLaneId: task.directionId ?? null,
      deltaX: 0,
      targetLaneId: task.directionId ?? null,
    });
  }, [tasks]);

  /* ── End drag logic (useEffect moved below useMemo for timelineStart) ── */

  const allAssignees = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.assignees?.forEach((a) => s.add(a.name)));
    return Array.from(s).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filterNoDirection) list = list.filter((t) => !t.directionId);
    else if (filterDirs.length > 0) list = list.filter((t) => t.directionId && filterDirs.includes(t.directionId));
    if (filterNoProduct) list = list.filter((t) => !t.productId);
    else if (filterProducts.length > 0) list = list.filter((t) => t.productId && filterProducts.includes(t.productId));
    if (filterNoAssignee) list = list.filter((t) => !t.assignees?.length);
    else if (filterNames.length > 0) {
      list = list.filter((t) => t.assignees?.some((a) => filterNames.includes(a.name)));
    }
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      list = list.filter((t) => {
        const end = getTaskEnd(t); end.setHours(0, 0, 0, 0);
        return end >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
      list = list.filter((t) => {
        const start = getTaskStart(t); start.setHours(0, 0, 0, 0);
        return start <= to;
      });
    }
    return list;
  }, [tasks, filterNames, filterDirs, filterProducts, filterNoDirection, filterNoProduct, filterNoAssignee, dateFrom, dateTo]);

  const { lanes, weeks, timelineStart, timelineW, todayX, monthHeaders } = useMemo(() => {
    const empty = { lanes: [] as Lane[], weeks: [] as Week[], timelineStart: new Date(), timelineW: 0, todayX: 0, monthHeaders: [] as { label: string; left: number; width: number }[] };
    if (!filtered.length) return empty;

    const colorMap = new Map<number, typeof laneColors[0]>();
    directions.forEach((d, i) => colorMap.set(d.id, laneColors[i % laneColors.length]));

    const now = new Date(); now.setHours(0, 0, 0, 0);
    let minDate = new Date(now), maxDate = addDays(now, 14);
    filtered.forEach((t) => {
      const s = getTaskStart(t); s.setHours(0, 0, 0, 0);
      const e = getTaskEnd(t); e.setHours(0, 0, 0, 0);
      if (s < minDate) minDate = new Date(s);
      if (e > maxDate) maxDate = new Date(e);
    });

    const firstMonday = getMonday(addDays(minDate, -7));
    const totalWeeks = Math.ceil(daysBetween(firstMonday, getMonday(addDays(maxDate, 14))) / 7) + 1;

    const weekList: Week[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const wStart = addDays(firstMonday, i * 7);
      const wEnd = addDays(wStart, 6);
      weekList.push({ start: wStart, end: wEnd, label: `${wStart.getDate()}-${wEnd.getDate()}`, month: wStart.getMonth(), year: wStart.getFullYear() });
    }

    const mHeaders: { label: string; left: number; width: number }[] = [];
    let cM = -1, cY = -1, mS = 0;
    weekList.forEach((w, i) => {
      if (w.month !== cM || w.year !== cY) {
        if (cM >= 0) mHeaders.push({ label: `${monthNames[cM]} ${cY}`, left: mS * weekW, width: (i - mS) * weekW });
        cM = w.month; cY = w.year; mS = i;
      }
    });
    if (cM >= 0) mHeaders.push({ label: `${monthNames[cM]} ${cY}`, left: mS * weekW, width: (weekList.length - mS) * weekW });

    const lanesArr: Lane[] = [];
    directions.forEach((dir) => {
      const dt = filtered.filter((t) => t.directionId === dir.id);
      if (dt.length > 0) {
        dt.sort((a, b) => getTaskStart(a).getTime() - getTaskStart(b).getTime());
        lanesArr.push({ id: dir.id, name: dir.name, color: colorMap.get(dir.id) || laneColors[0], tasks: dt });
      }
    });
    const noDir = filtered.filter((t) => !t.directionId);
    if (noDir.length > 0) {
      noDir.sort((a, b) => getTaskStart(a).getTime() - getTaskStart(b).getTime());
      lanesArr.push({ id: null, name: 'Без направления', color: noColor, tasks: noDir });
    }

    const todayDays = daysBetween(firstMonday, now);
    return { lanes: lanesArr, weeks: weekList, timelineStart: firstMonday, timelineW: weekList.length * weekW, todayX: (todayDays / 7) * weekW, monthHeaders: mHeaders };
  }, [filtered, directions, weekW]);

  /* ── Drag useEffect (needs timelineStart from useMemo above) ── */
  useEffect(() => {
    if (!dragState) return;
    const dr = dragRef.current;
    if (!dr) return;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - dr.startX;
      const dy = e.clientY - dr.startY;
      if (!dr.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      dr.moved = true;
      const targetLane = dr.mode === 'move' ? (findLaneAtY(e.clientY) ?? dr.origLaneId) : dr.origLaneId;
      setDragState((prev) => prev ? { ...prev, deltaX: dx, targetLaneId: targetLane === undefined ? prev.origLaneId : targetLane } : null);
      if (dr.mode === 'move') {
        setHighlightLaneId(targetLane === undefined ? dr.origLaneId : targetLane);
      }
    };

    const onUp = () => {
      const wasMoved = dr.moved;
      dragRef.current = null;
      setHighlightLaneId(undefined);
      if (wasMoved) _lastDragEnd = Date.now();

      if (!wasMoved) { setDragState(null); return; }

      setDragState((prev) => {
        if (!prev) return null;
        const { taskId, mode, origLeft, origWidth, origLaneId, deltaX, targetLaneId } = prev;
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return null;

        const update: Record<string, unknown> = {};
        if (mode === 'move') {
          const newLeft = origLeft + deltaX;
          const newStart = pixelToDate(newLeft, timelineStart, weekW);
          const dur = daysBetween(getTaskStart(task), getTaskEnd(task));
          const newEnd = addDays(newStart, dur);
          update.startDate = newStart.toISOString().slice(0, 10);
          update.deadline = newEnd.toISOString().slice(0, 10);
          if (targetLaneId !== origLaneId) update.directionId = targetLaneId;
        } else if (mode === 'resize-left') {
          const newWidth = origWidth - deltaX;
          if (newWidth >= MIN_BAR_W) {
            const newStart = pixelToDate(origLeft + deltaX, timelineStart, weekW);
            update.startDate = newStart.toISOString().slice(0, 10);
          }
        } else if (mode === 'resize-right') {
          const newWidth = Math.max(MIN_BAR_W, origWidth + deltaX);
          const newEnd = pixelToDate(origLeft + newWidth, timelineStart, weekW);
          update.deadline = newEnd.toISOString().slice(0, 10);
        }

        if (Object.keys(update).length > 0) {
          setTasks((pt) => pt.map((t) => {
            if (t.id !== taskId) return t;
            const patched = { ...t };
            if (update.startDate) patched.startDate = update.startDate as string;
            if (update.deadline) patched.deadline = update.deadline as string;
            if (update.directionId !== undefined) patched.directionId = update.directionId as number | null;
            return patched;
          }));
          api.updateTaskPublic(taskId, update).catch(() => loadData());
        }
        return null;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [dragState, tasks, timelineStart, weekW, pixelToDate, findLaneAtY]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (ignoreNextTimelineScroll.current) {
        ignoreNextTimelineScroll.current = false;
        return;
      }
      setTitlePopover(null);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [lanes.length, loading, timelineW]);

  function computeLaneBars(lane: Lane): BarPos[] {
    const barMeta = lane.tasks.map((task) => {
      const s = getTaskStart(task); s.setHours(0, 0, 0, 0);
      const e = getTaskEnd(task); e.setHours(0, 0, 0, 0);
      const left = (daysBetween(timelineStart, s) / 7) * weekW;
      const width = Math.max((Math.max(daysBetween(s, e), 1) / 7) * weekW, 30);
      return { task, left, width };
    });
    const rows = computeRows(barMeta);
    return barMeta.map((b, i) => ({ ...b, row: rows[i] }));
  }

  function laneTotalHeight(lane: Lane, isOpen: boolean): number {
    const summary = SUMMARY_H;
    if (!isOpen) return summary;
    const bars = computeLaneBars(lane);
    return summary + laneHeight(bars);
  }

  useEffect(() => {
    if (!loading && scrollRef.current && todayX > 0) {
      ignoreNextTimelineScroll.current = true;
      scrollRef.current.scrollLeft = Math.max(0, todayX - 80);
    }
  }, [loading, todayX]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const toggleLane = (id: number | null) => {
    setTitlePopover(null);
    const key = id ?? 'none';
    setExpandedLane(expandedLane === key ? null : key);
  };

  return (
    <div className="max-w-3xl lg:max-w-7xl mx-auto px-2 lg:px-6">
      <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-purple-800 text-white px-5 pb-5 rounded-b-3xl shadow-xl safe-top">
        {(() => {
          const userName = localStorage.getItem('tp_user_name') || '';
          const hour = new Date().getHours();
          const greet = hour < 6 ? '🌙 Доброй ночи' : hour < 12 ? '☀️ Доброе утро' : hour < 18 ? '👋 Добрый день' : '🌆 Добрый вечер';
          return userName ? (
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold">{userName[0]}</span>
              <div>
                <p className="text-xs text-purple-300">{greet}</p>
                <p className="text-sm font-semibold">{userName}</p>
              </div>
            </div>
          ) : null;
        })()}
        <h1 className="text-xl font-bold">🗺️ Роадмап</h1>
      </div>

      <div className="px-4 mt-4 space-y-2">
        {/* Ответственные */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => { setFilterNames([]); setFilterNoAssignee(false); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterNames.length === 0 && !filterNoAssignee ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            Все
          </button>
          {allAssignees.map((name) => {
            const isActive = filterNames.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => { setFilterNames((prev) => isActive ? prev.filter((n) => n !== name) : [...prev, name]); setFilterNoAssignee(false); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setFilterNoAssignee((v) => !v); setFilterNames([]); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterNoAssignee ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-red-500 border border-red-200 hover:border-red-300'
            }`}
          >
            Без ответственных
          </button>
        </div>
        {/* Направления */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {directions.map((dir) => {
            const isActive = filterDirs.includes(dir.id);
            return (
              <button
                key={dir.id}
                type="button"
                onClick={() => { setFilterDirs((prev) => isActive ? prev.filter((d) => d !== dir.id) : [...prev, dir.id]); setFilterNoDirection(false); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-purple-600 border border-purple-200 hover:border-purple-300'
                }`}
              >
                {dir.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setFilterNoDirection((v) => !v); setFilterDirs([]); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterNoDirection ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-red-500 border border-red-200 hover:border-red-300'
            }`}
          >
            Без направления
          </button>
        </div>
        {/* Продукты */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {allProducts.map((p) => {
            const isActive = filterProducts.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { setFilterProducts((prev) => isActive ? prev.filter((x) => x !== p.id) : [...prev, p.id]); setFilterNoProduct(false); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                }`}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setFilterNoProduct((v) => !v); setFilterProducts([]); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterNoProduct ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-red-500 border border-red-200 hover:border-red-300'
            }`}
          >
            Без продукта
          </button>
        </div>
        {/* Даты */}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
          <span className="text-gray-400 text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-gray-400 hover:text-gray-600 text-xs shrink-0">
              Сброс
            </button>
          )}
        </div>
      </div>

      {lanes.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">🗺️</span>
          <p className="text-gray-400 mt-4 text-sm">Добавьте задачи с направлениями</p>
        </div>
      ) : (
        <div className="mt-4 mb-8">
          <div className="flex">
            <div className="shrink-0 z-20 bg-white" style={{ width: LABEL_W }}>
              <div className="h-[52px] border-b border-gray-200 bg-gray-50" />
              {lanes.map((lane) => {
                const laneKey = lane.id ?? 'none';
                const isOpen = expandedLane === laneKey;
                const bars = computeLaneBars(lane);
                const isHighlight = highlightLaneId !== undefined && highlightLaneId === lane.id && dragState?.origLaneId !== lane.id;
                return (
                  <div key={laneKey} className={`border-b border-gray-100 flex flex-col transition-colors ${isHighlight ? 'bg-indigo-50/60' : ''}`}>
                    <button
                      type="button"
                      className="flex items-stretch w-full text-left hover:bg-gray-50 transition-colors"
                      style={{ height: SUMMARY_H }}
                      onClick={() => toggleLane(lane.id)}
                    >
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-br-lg w-full ${lane.color.label} text-[11px] font-bold leading-tight`}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          viewBox="0 0 20 20" fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{lane.name}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div
                        className="border-t border-gray-50 bg-white/80 shrink-0"
                        style={{ height: laneHeight(bars) }}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto scrollbar-hide"
            >
              <div style={{ width: timelineW, minWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="flex" style={{ height: 24 }}>
                    {monthHeaders.map((mh, i) => (
                      <div
                        key={i}
                        className="text-[11px] font-bold text-gray-600 flex items-center px-3 border-r border-gray-200"
                        style={{ width: mh.width, marginLeft: i === 0 ? mh.left : 0 }}
                      >
                        {mh.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex" style={{ height: 28 }}>
                    {weeks.map((w, i) => {
                      const now = new Date(); now.setHours(0, 0, 0, 0);
                      const isThisWeek = now >= w.start && now <= w.end;
                      return (
                        <div
                          key={i}
                          className={`shrink-0 text-center text-[10px] border-r border-gray-100 flex items-center justify-center ${isThisWeek ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-400'}`}
                          style={{ width: weekW }}
                        >
                          {w.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {lanes.map((lane) => {
                  const laneKey = lane.id ?? 'none';
                  const isOpen = expandedLane === laneKey;
                  const totalH = laneTotalHeight(lane, isOpen);
                  const bars = computeLaneBars(lane);
                  const isHighlight = highlightLaneId !== undefined && highlightLaneId === lane.id && dragState?.origLaneId !== lane.id;

                  return (
                    <div
                      key={laneKey}
                      ref={(el) => { if (el) laneRowRefs.current.set(String(laneKey), el); }}
                      className={`relative border-b border-gray-100 transition-colors ${isHighlight ? 'bg-indigo-50/60' : ''}`}
                      style={{ height: totalH }}
                    >
                      {weeks.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100 z-[1]" style={{ left: i * weekW }} />
                      ))}
                      <div className="absolute top-0 bottom-0 w-px bg-indigo-400/50 z-[2]" style={{ left: todayX }} />

                      <div className="relative z-[2]" style={{ height: SUMMARY_H }}>
                        <SummaryTimeline
                          tasks={lane.tasks}
                          timelineStart={timelineStart}
                          weekW={weekW}
                          laneColor={lane.color}
                          openTitlePopover={openTitlePopover}
                          openGroupPopover={openGroupPopover}
                          onDragStart={handleDragStart}
                          dragState={dragState}
                        />
                      </div>

                      {isOpen &&
                        bars.map(({ task, left, width, row }) => (
                          <InteractiveBar
                            key={task.id}
                            task={task}
                            left={left}
                            width={width}
                            topPx={SUMMARY_H + LANE_PAD + row * (BAR_H + ROW_GAP)}
                            laneColor={lane.color}
                            openTitlePopover={openTitlePopover}
                            onDragStart={handleDragStart}
                            dragState={dragState}
                          />
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {lanes.map((lane) => {
            const laneKey = lane.id ?? 'none';
            if (expandedLane !== laneKey) return null;
            return (
              <div key={laneKey} className="bg-gray-50 border-t border-gray-200 px-4 py-3 space-y-2">
                <h3 className={`text-xs font-bold mb-2 ${lane.color.label} inline-block px-2 py-1 rounded-lg`}>
                  {lane.name} — {lane.tasks.length} задач
                </h3>
                {lane.tasks.map((task) => {
                  const isDone = task.status === 'done';
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isDone;
                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      state={{ from: '/roadmap' }}
                      className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md transition-all ${isDone ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[task.status]}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium block truncate ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{statusLabel[task.status]}</span>
                          {task.deadline && (
                            <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                              → {friendlyDeadline(task.deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.assignees?.length > 0 && (
                        <div className="flex -space-x-1 shrink-0">
                          {task.assignees.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[9px] flex items-center justify-center font-bold border-2 border-white"
                              title={a.name}
                            >
                              {a.name[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {titlePopover &&
        createPortal(
          <div
            data-roadmap-popover-layer
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483647,
              pointerEvents: 'none',
              isolation: 'isolate',
            }}
            aria-hidden
          >
            <div
              data-roadmap-title-popover
              role="tooltip"
              className="rounded-xl bg-gray-900 text-white text-xs shadow-2xl border border-white/10 break-words"
              style={{
                position: 'absolute',
                left: titlePopover.left,
                top: titlePopover.top,
                maxWidth: titlePopover.maxWidth,
                pointerEvents: 'auto',
              }}
            >
              {titlePopover.tasks ? (
                <div className="py-1.5">
                  <p className="px-3 py-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    {titlePopover.tasks.length} задач(и) на этот период
                  </p>
                  {titlePopover.tasks.map((t) => {
                    const isDone = t.status === 'done';
                    const isOverdue = t.deadline && new Date(t.deadline) < new Date() && !isDone;
                    return (
                      <Link
                        key={t.id}
                        to={`/tasks/${t.id}`}
                        state={{ from: '/roadmap' }}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={() => setTitlePopover(null)}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[t.status]}`} />
                        <span className={`flex-1 truncate text-xs ${isDone ? 'text-gray-400 line-through' : isOverdue ? 'text-red-300' : 'text-white'}`}>
                          {t.title}
                        </span>
                        {t.deadline && (
                          <span className={`shrink-0 text-[10px] ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                            {friendlyDeadline(t.deadline)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-2">{titlePopover.title}</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
