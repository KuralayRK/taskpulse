import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  api,
  type MvpItem,
  type MvpMonth,
  type Product,
  type Direction,
  type Task,
} from '../api';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTH_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const MONTH_COLORS = [
  'from-blue-500/10 to-blue-500/5 border-blue-200/80',
  'from-sky-500/10 to-sky-500/5 border-sky-200/80',
  'from-emerald-500/10 to-emerald-500/5 border-emerald-200/80',
  'from-green-500/10 to-green-500/5 border-green-200/80',
  'from-lime-500/10 to-lime-500/5 border-lime-200/80',
  'from-amber-500/10 to-amber-500/5 border-amber-200/80',
  'from-orange-500/10 to-orange-500/5 border-orange-200/80',
  'from-red-500/10 to-red-500/5 border-red-200/80',
  'from-rose-500/10 to-rose-500/5 border-rose-200/80',
  'from-purple-500/10 to-purple-500/5 border-purple-200/80',
  'from-violet-500/10 to-violet-500/5 border-violet-200/80',
  'from-indigo-500/10 to-indigo-500/5 border-indigo-200/80',
];

const MONTH_HEADER_COLORS = [
  'bg-blue-500', 'bg-sky-500', 'bg-emerald-500', 'bg-green-500',
  'bg-lime-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500',
  'bg-rose-500', 'bg-purple-500', 'bg-violet-500', 'bg-indigo-500',
];

const LANE_PALETTE = [
  { bar: 'bg-violet-500', barBg: 'bg-violet-500/20', border: 'border-violet-400/50' },
  { bar: 'bg-sky-500', barBg: 'bg-sky-500/20', border: 'border-sky-400/50' },
  { bar: 'bg-emerald-500', barBg: 'bg-emerald-500/20', border: 'border-emerald-400/50' },
  { bar: 'bg-amber-500', barBg: 'bg-amber-500/20', border: 'border-amber-400/50' },
  { bar: 'bg-rose-500', barBg: 'bg-rose-500/20', border: 'border-rose-400/50' },
  { bar: 'bg-indigo-500', barBg: 'bg-indigo-500/20', border: 'border-indigo-400/50' },
];

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
};

function formatMonthShort(ym: string): string {
  const m = Number(ym.split('-')[1]);
  return MONTH_SHORT[m - 1] ?? ym;
}

function monthNumber(ym: string): number {
  return Number(ym.split('-')[1]);
}

function friendlyDeadline(deadline: string | null | undefined): string {
  if (!deadline) return 'без срока';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const days = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
  if (days < -1) return `${Math.abs(days)} дн. назад`;
  if (days === -1) return 'вчера';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days <= 7) return `через ${days} дн.`;
  return dl.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function buildColumnsFromMonths(monthsList: MvpMonth[]): Record<number, number[]> {
  const m: Record<number, number[]> = {};
  for (const mo of monthsList) m[mo.id] = mo.items.map((i) => i.id);
  return m;
}

function buildItemMap(monthsList: MvpMonth[]): Map<number, MvpItem> {
  const map = new Map<number, MvpItem>();
  for (const mo of monthsList) {
    for (const it of mo.items) map.set(it.id, { ...it, monthId: mo.id });
  }
  return map;
}

function moveItemInColumns(
  cols: Record<number, number[]>,
  itemId: number,
  toMonthId: number,
  toIndex: number,
): Record<number, number[]> {
  const next: Record<number, number[]> = {};
  for (const k of Object.keys(cols)) next[Number(k)] = cols[Number(k)].filter((id) => id !== itemId);
  const arr = [...(next[toMonthId] ?? [])];
  arr.splice(Math.max(0, Math.min(toIndex, arr.length)), 0, itemId);
  next[toMonthId] = arr;
  return next;
}

function columnsToUpdates(cols: Record<number, number[]>) {
  const updates: { id: number; monthId: number; sortOrder: number }[] = [];
  for (const midStr of Object.keys(cols)) {
    const monthId = Number(midStr);
    cols[monthId].forEach((id, sortOrder) => updates.push({ id, monthId, sortOrder }));
  }
  return updates;
}

function itemMatchesFilters(
  item: MvpItem,
  directionId: number | null,
  productId: number | null,
): boolean {
  if (productId != null) return item.productId === productId;
  if (directionId != null) {
    if (!item.product) return false;
    return item.product.directionId === directionId;
  }
  return true;
}

function visibleColumnSpan(
  item: MvpItem,
  filteredMonths: MvpMonth[],
  allMonths: MvpMonth[],
): { from: number; to: number } | null {
  const byId = new Map(allMonths.map((m) => [m.id, m]));
  const sm = byId.get(item.monthId);
  if (!sm) return null;
  const em = item.endMonthId ? byId.get(item.endMonthId) : sm;
  if (!em) return null;
  const lo = Math.min(sm.sortOrder, em.sortOrder);
  const hi = Math.max(sm.sortOrder, em.sortOrder);
  let from = -1;
  let to = -1;
  filteredMonths.forEach((m, i) => {
    if (m.sortOrder >= lo && m.sortOrder <= hi) {
      if (from < 0) from = i;
      to = i;
    }
  });
  if (from < 0) return null;
  return { from, to };
}

function computeBarRows(bars: { left: number; width: number }[]): number[] {
  const rows: number[] = [];
  const rowEnds: number[] = [];
  for (const { left, width } of bars) {
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (left >= rowEnds[r] + 2) {
        rowEnds[r] = left + width;
        rows.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rowEnds.push(left + width);
      rows.push(rowEnds.length - 1);
    }
  }
  return rows;
}

function epicProgress(item: MvpItem): { done: number; total: number } | null {
  const tasks = item.tasks ?? [];
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total: tasks.length };
}

/* ─── Scroll arrows ─── */
function ScrollArrows({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [scrollRef, check]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const btnClass =
    'w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-all active:scale-90 disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btnClass} disabled={!canLeft} onClick={() => scroll(-1)} aria-label="Влево">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button type="button" className={btnClass} disabled={!canRight} onClick={() => scroll(1)} aria-label="Вправо">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Draggable epic card ─── */
function EpicCard({
  item,
  monthById,
  onEditTitle,
  onDelete,
  onOpen,
  showProgress,
}: {
  item: MvpItem;
  monthById: Map<number, MvpMonth>;
  onEditTitle: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onOpen: (item: MvpItem) => void;
  showProgress: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { item },
  });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.35 : 1 }
    : undefined;

  const endMonth = item.endMonthId ? monthById.get(item.endMonthId) : null;
  const spanLabel =
    endMonth && item.endMonthId !== item.monthId
      ? `→ ${formatMonthShort(endMonth.yearMonth)}`
      : null;

  const progress = epicProgress(item);
  const showBar = showProgress && progress != null;

  useEffect(() => {
    setEditVal(item.title);
  }, [item.title]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditVal(item.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitEdit = () => {
    setEditing(false);
    const v = editVal.trim();
    if (v && v !== item.title) onEditTitle(item.id, v);
  };

  if (editing) {
    return (
      <div
        className="rounded-xl bg-white border-2 border-indigo-400 px-2 py-2 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full text-[13px] text-gray-900 bg-transparent outline-none"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') {
              setEditVal(item.title);
              setEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="group rounded-xl bg-white/95 border border-gray-200/90 pl-1 pr-1.5 py-2 cursor-pointer touch-none shadow-sm hover:shadow-md hover:border-indigo-300/80 transition-all flex items-stretch gap-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <button
        type="button"
        className="shrink-0 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Перетащить"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[13px] text-gray-800 leading-snug font-medium">{item.title}</p>
        {showBar && progress ? (
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
        ) : null}
        {spanLabel ? (
          <p className="text-[10px] font-semibold text-indigo-600/90">{spanLabel}</p>
        ) : null}
      </div>
      <div className="shrink-0 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={startEdit}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
          title="Редактировать"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
          title="Удалить"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MonthColumn({
  month,
  itemIds,
  itemMap,
  monthById,
  directionFilter,
  productFilter,
  onEditTitle,
  onDelete,
  onOpenCard,
  showProgress,
}: {
  month: MvpMonth;
  itemIds: number[];
  itemMap: Map<number, MvpItem>;
  monthById: Map<number, MvpMonth>;
  directionFilter: number | null;
  productFilter: number | null;
  onEditTitle: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onOpenCard: (item: MvpItem) => void;
  showProgress: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `month-${month.id}` });
  const mi = monthNumber(month.yearMonth) - 1;
  const gradClass = MONTH_COLORS[mi] ?? MONTH_COLORS[0];
  const headerBg = MONTH_HEADER_COLORS[mi] ?? MONTH_HEADER_COLORS[0];

  const visibleIds = itemIds.filter((id) => {
    const it = itemMap.get(id);
    return it && itemMatchesFilters(it, directionFilter, productFilter);
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[188px] sm:w-[208px] flex flex-col rounded-2xl border-2 min-h-[160px] transition-all bg-gradient-to-b ${gradClass} ${
        isOver ? 'ring-2 ring-indigo-400 scale-[1.02]' : ''
      }`}
    >
      <div className="relative px-3 pt-3 pb-2">
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${headerBg}`} />
        <p className="text-sm font-bold text-gray-900 mt-1">{formatMonthShort(month.yearMonth)}</p>
        <p className="text-[10px] text-gray-600 font-medium">
          {visibleIds.length}{' '}
          {visibleIds.length === 1 ? 'эпик' : visibleIds.length < 5 ? 'эпика' : 'эпиков'}
        </p>
      </div>
      <div className="px-2 pb-3 flex flex-col gap-2 flex-1">
        {visibleIds.map((id) => {
          const item = itemMap.get(id);
          if (!item) return null;
          return (
            <EpicCard
              key={id}
              item={item}
              monthById={monthById}
              onEditTitle={onEditTitle}
              onDelete={onDelete}
              onOpen={onOpenCard}
              showProgress={showProgress}
            />
          );
        })}
        {visibleIds.length === 0 ? (
          <p className="text-[11px] text-gray-400/90 text-center py-6 italic">Нет эпиков</p>
        ) : null}
      </div>
    </div>
  );
}

type EpicDetail = Omit<MvpItem, 'tasks'> & {
  month: MvpMonth;
  endMonth: MvpMonth | null;
  tasks: Task[];
};

const MVP_ADD_EVENT = 'mvp-open-add-epic';

export default function MvpPage() {
  const [months, setMonths] = useState<MvpMonth[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<Record<number, number[]>>({});
  const [itemMap, setItemMap] = useState<Map<number, MvpItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MvpItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [directionFilter, setDirectionFilter] = useState<number | null>(null);
  const [productFilter, setProductFilter] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState(0);
  const [rangeTo, setRangeTo] = useState(11);
  const [showProgress, setShowProgress] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EpicDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addProductId, setAddProductId] = useState<number | ''>('');
  const [addMonthId, setAddMonthId] = useState<number | ''>('');
  const [addEndMonthId, setAddEndMonthId] = useState<number | ''>('');
  const [addSaving, setAddSaving] = useState(false);

  const boardScrollRef = useRef<HTMLDivElement>(null);
  const roadmapScrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api
      .getMvpBoard()
      .then((d) => {
        setMonths(d.months);
        setDirections(d.directions);
        setProducts(d.products);
        setColumns(buildColumnsFromMonths(d.months));
        setItemMap(buildItemMap(d.months));
        setAddMonthId((prev) => (prev === '' && d.months.length ? d.months[0].id : prev));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Не удалось загрузить MVP';
        setLoadError(msg);
        setMonths([]);
        setDirections([]);
        setProducts([]);
        setColumns({});
        setItemMap(new Map());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const openAdd = () => setShowAddModal(true);
    window.addEventListener(MVP_ADD_EVENT, openAdd);
    return () => window.removeEventListener(MVP_ADD_EVENT, openAdd);
  }, []);

  useEffect(() => {
    if (directionFilter == null) return;
    setProductFilter((prev) => {
      if (prev == null) return prev;
      const p = products.find((x) => x.id === prev);
      if (!p || p.directionId !== directionFilter) return null;
      return prev;
    });
  }, [directionFilter, products]);

  const monthById = useMemo(() => new Map(months.map((m) => [m.id, m])), [months]);

  const filteredMonths = useMemo(
    () =>
      months.filter((mo) => {
        const m = monthNumber(mo.yearMonth);
        return m >= rangeFrom + 1 && m <= rangeTo + 1;
      }),
    [months, rangeFrom, rangeTo],
  );

  const productsForDirection = useMemo(() => {
    if (directionFilter == null) return products;
    return products.filter((p) => p.directionId === directionFilter);
  }, [products, directionFilter]);

  const filteredEpicCount = useMemo(() => {
    let n = 0;
    for (const mo of filteredMonths) {
      for (const id of columns[mo.id] ?? []) {
        const it = itemMap.get(id);
        if (it && itemMatchesFilters(it, directionFilter, productFilter)) n++;
      }
    }
    return n;
  }, [filteredMonths, columns, itemMap, directionFilter, productFilter]);

  const persistOrder = useCallback(async (nextCols: Record<number, number[]>) => {
    setSaving(true);
    try {
      await api.putMvpItemsOrder(columnsToUpdates(nextCols));
      setColumns(nextCols);
    } catch {
      void load();
    } finally {
      setSaving(false);
    }
  }, [load]);

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('item-')) setActiveItem(itemMap.get(Number(id.replace('item-', ''))) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = Number(String(active.id).replace('item-', ''));
    if (Number.isNaN(activeId)) return;
    const overStr = String(over.id);
    let targetMonthId: number;
    let targetIndex: number;
    if (overStr.startsWith('month-')) {
      targetMonthId = Number(overStr.replace('month-', ''));
      targetIndex = (columns[targetMonthId] ?? []).filter((id) => id !== activeId).length;
    } else if (overStr.startsWith('item-')) {
      const overItemId = Number(overStr.replace('item-', ''));
      const overItem = itemMap.get(overItemId);
      if (!overItem) return;
      targetMonthId = overItem.monthId;
      const col = (columns[targetMonthId] ?? []).filter((id) => id !== activeId);
      const idx = col.indexOf(overItemId);
      targetIndex = idx >= 0 ? idx : col.length;
    } else return;

    const next = moveItemInColumns(columns, activeId, targetMonthId, targetIndex);
    setItemMap((prev) => {
      const m = new Map(prev);
      const it = m.get(activeId);
      if (it) m.set(activeId, { ...it, monthId: targetMonthId });
      return m;
    });
    void persistOrder(next);
  };

  const handleEditTitle = useCallback(async (id: number, title: string) => {
    try {
      await api.updateMvpItem(id, { title });
      setItemMap((prev) => {
        const m = new Map(prev);
        const it = m.get(id);
        if (it) m.set(id, { ...it, title });
        return m;
      });
      setDetail((d) => (d && d.id === id ? { ...d, title } : d));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleDeleteItem = useCallback(
    async (id: number) => {
      try {
        await api.deleteMvpItem(id);
        setItemMap((prev) => {
          const m = new Map(prev);
          m.delete(id);
          return m;
        });
        setColumns((prev) => {
          const next: Record<number, number[]> = {};
          for (const k of Object.keys(prev)) next[Number(k)] = prev[Number(k)].filter((i) => i !== id);
          return next;
        });
        if (detailId === id) {
          setDetailId(null);
          setDetail(null);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [detailId],
  );

  const openDetail = useCallback((item: MvpItem) => {
    setDetailId(item.id);
  }, []);

  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api
      .getMvpItem(detailId)
      .then((d) => setDetail(d as EpicDetail))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [detailId]);

  const closeDetail = useCallback(() => {
    setDetailId(null);
    setDetail(null);
  }, []);

  const submitAddEpic = async () => {
    if (!addTitle.trim() || addMonthId === '') return;
    setAddSaving(true);
    try {
      await api.createMvpItem({
        title: addTitle.trim(),
        monthId: Number(addMonthId),
        endMonthId: addEndMonthId === '' ? null : Number(addEndMonthId),
        productId: addProductId === '' ? null : Number(addProductId),
      });
      setAddTitle('');
      setAddProductId('');
      setAddEndMonthId('');
      setShowAddModal(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setAddSaving(false);
    }
  };

  const ROADMAP_CELL = 76;
  const BAR_H = 24;
  const LANE_LABEL_W = 120;

  const roadmapLanes = useMemo(() => {
    const epicList: MvpItem[] = [];
    for (const mo of months) {
      for (const id of columns[mo.id] ?? []) {
        const it = itemMap.get(id);
        if (it && itemMatchesFilters(it, directionFilter, productFilter)) epicList.push(it);
      }
    }
    const byProduct = new Map<number | 'none', MvpItem[]>();
    for (const it of epicList) {
      const k = it.productId ?? 'none';
      if (!byProduct.has(k)) byProduct.set(k, []);
      byProduct.get(k)!.push(it);
    }
    const lanes: { key: number | 'none'; label: string; items: MvpItem[]; paletteIdx: number }[] = [];
    const sortedKeys = [...byProduct.keys()].sort((a, b) => {
      if (a === 'none') return 1;
      if (b === 'none') return -1;
      const pa = products.find((p) => p.id === a);
      const pb = products.find((p) => p.id === b);
      return (pa?.name ?? '').localeCompare(pb?.name ?? '', 'ru');
    });
    for (const key of sortedKeys) {
      const items = byProduct.get(key)!;
      if (key === 'none') {
        lanes.push({ key, label: 'Без продукта', items, paletteIdx: 0 });
      } else {
        const p = products.find((pr) => pr.id === key);
        const dir = p?.direction;
        lanes.push({
          key,
          label: dir ? `${p?.name ?? '?'} · ${dir.name}` : (p?.name ?? `Продукт #${key}`),
          items,
          paletteIdx: key % LANE_PALETTE.length,
        });
      }
    }
    return { lanes, epicList };
  }, [months, columns, itemMap, directionFilter, productFilter, products]);

  const roadmapHeight = useMemo(() => {
    let h = 0;
    for (const lane of roadmapLanes.lanes) {
      const bars = lane.items
        .map((it) => {
          const span = visibleColumnSpan(it, filteredMonths, months);
          if (!span) return null;
          return { left: span.from * ROADMAP_CELL, width: (span.to - span.from + 1) * ROADMAP_CELL - 4 };
        })
        .filter(Boolean) as { left: number; width: number }[];
      const rows = computeBarRows(bars);
      const maxRow = rows.length ? Math.max(...rows) : -1;
      const laneH = (maxRow + 1) * (BAR_H + 4) + 12;
      h += laneH;
    }
    return Math.max(h, 48);
  }, [roadmapLanes, filteredMonths, months]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 pb-24 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-red-500">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 lg:px-4 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-indigo-900 text-white px-5 pb-6 pt-5 rounded-b-3xl shadow-xl safe-top">
        <h1 className="text-xl font-bold tracking-tight">📋 MVP-план</h1>
        <p className="text-sm text-white/75 mt-1 max-w-xl">
          Эпики по месяцам, связь с продуктами и задачами.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/10">
            <div className="text-xl font-bold text-amber-200">{filteredEpicCount}</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wide">эпиков</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/10">
            <div className="text-xl font-bold text-emerald-200">{filteredMonths.length}</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wide">месяцев</div>
          </div>
          {saving ? (
            <span className="text-xs text-white/70 ml-auto">Сохранение порядка…</span>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 space-y-3 px-1">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Направление</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDirectionFilter(null);
                setProductFilter(null);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                directionFilter === null
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
              }`}
            >
              Все
            </button>
            {directions.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDirectionFilter(d.id);
                  setProductFilter(null);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  directionFilter === d.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Продукт</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setProductFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                productFilter === null
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-violet-300'
              }`}
            >
              Все
            </button>
            {productsForDirection.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductFilter(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all max-w-[200px] truncate ${
                  productFilter === p.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-violet-300'
                }`}
                title={p.name}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">С</span>
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 shadow-sm"
              value={rangeFrom}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRangeFrom(v);
                if (v > rangeTo) setRangeTo(v);
              }}
            >
              {MONTH_NAMES.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 font-medium">по</span>
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 shadow-sm"
              value={rangeTo}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRangeTo(v);
                if (v < rangeFrom) setRangeFrom(v);
              }}
            >
              {MONTH_NAMES.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-indigo-600 tabular-nums">
              {rangeTo - rangeFrom + 1} мес.
            </span>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none ml-auto sm:ml-0">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={showProgress}
              onChange={(e) => setShowProgress(e.target.checked)}
            />
            <span className="text-sm text-gray-700 font-medium">Показать прогресс</span>
          </label>
        </div>
      </div>

      {/* Board toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-md shadow-indigo-600/25 hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Добавить эпик
        </button>
        <ScrollArrows scrollRef={boardScrollRef} />
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={boardScrollRef}
          className="overflow-x-auto pb-4 px-1 mt-3 scroll-smooth -mx-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="flex gap-3 min-w-min">
            {filteredMonths.map((mo) => (
              <MonthColumn
                key={mo.id}
                month={mo}
                itemIds={columns[mo.id] ?? []}
                itemMap={itemMap}
                monthById={monthById}
                directionFilter={directionFilter}
                productFilter={productFilter}
                onEditTitle={handleEditTitle}
                onDelete={handleDeleteItem}
                onOpenCard={openDetail}
                showProgress={showProgress}
              />
            ))}
            {filteredMonths.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center w-full">Нет месяцев в диапазоне</p>
            ) : null}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="rounded-xl bg-white border-2 border-indigo-400 px-3 py-2.5 shadow-2xl w-[200px]">
              <p className="text-[13px] font-medium text-gray-800">{activeItem.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Roadmap section */}
      <div className="mt-10 border-t border-gray-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
          <h2 className="text-lg font-bold text-gray-900">Дорожная карта</h2>
          <ScrollArrows scrollRef={roadmapScrollRef} />
        </div>
        <div
          ref={roadmapScrollRef}
          className="overflow-x-auto rounded-2xl border border-gray-200 bg-gray-50/80 shadow-inner"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="inline-block min-w-min p-3">
            <div className="flex" style={{ paddingLeft: LANE_LABEL_W }}>
              {filteredMonths.map((mo, i) => {
                const mi = monthNumber(mo.yearMonth) - 1;
                const h = MONTH_HEADER_COLORS[mi] ?? MONTH_HEADER_COLORS[0];
                return (
                  <div
                    key={mo.id}
                    className={`shrink-0 text-center text-[10px] font-bold text-white py-1.5 rounded-t-lg ${h}`}
                    style={{ width: ROADMAP_CELL }}
                  >
                    {formatMonthShort(mo.yearMonth)}
                  </div>
                );
              })}
            </div>
            {filteredMonths.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Нет месяцев</p>
            ) : roadmapLanes.lanes.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center pl-4">Нет эпиков по фильтрам</p>
            ) : (
              <div className="relative" style={{ minHeight: roadmapHeight }}>
                {roadmapLanes.lanes.map((lane) => {
                    const bars = lane.items
                      .map((it) => {
                        const span = visibleColumnSpan(it, filteredMonths, months);
                        if (!span) return null;
                        return {
                          item: it,
                          left: span.from * ROADMAP_CELL,
                          width: (span.to - span.from + 1) * ROADMAP_CELL - 4,
                        };
                      })
                      .filter(Boolean) as { item: MvpItem; left: number; width: number }[];
                    const geom = bars.map((b) => ({ left: b.left, width: b.width }));
                    const rows = computeBarRows(geom);
                    const maxRow = rows.length ? Math.max(...rows) : -1;
                    const laneH = (maxRow + 1) * (BAR_H + 4) + 12;
                    const palette = LANE_PALETTE[lane.paletteIdx % LANE_PALETTE.length];
                    return (
                      <div key={String(lane.key)} className="flex border-b border-gray-200/80 last:border-0" style={{ minHeight: laneH }}>
                        <div
                          className="shrink-0 flex items-center px-2 py-2 text-[11px] font-semibold text-gray-700 bg-white/90 border-r border-gray-200 sticky left-0 z-10"
                          style={{ width: LANE_LABEL_W }}
                        >
                          <span className="line-clamp-3 leading-tight">{lane.label}</span>
                        </div>
                        <div className="relative flex-1" style={{ width: filteredMonths.length * ROADMAP_CELL, minHeight: laneH }}>
                          {bars.map((b, i) => {
                            const row = rows[i];
                            const top = 6 + row * (BAR_H + 4);
                            return (
                              <button
                                key={b.item.id}
                                type="button"
                                onClick={() => openDetail(b.item)}
                                className={`absolute text-left px-2 py-1 rounded-lg border text-[10px] font-semibold text-white truncate shadow-sm hover:brightness-110 transition-all ${palette.bar} ${palette.border}`}
                                style={{ left: b.left + 2, width: b.width, top, height: BAR_H }}
                                title={b.item.title}
                              >
                                {b.item.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add epic modal */}
      {showAddModal
        ? createPortal(
            <div
              className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mvp-add-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                aria-label="Закрыть"
                onClick={() => setShowAddModal(false)}
              />
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-5 z-10">
                <h2 id="mvp-add-title" className="text-lg font-bold text-gray-900 mb-4">
                  Новый эпик
                </h2>
                <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                <input
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Название эпика"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitAddEpic();
                  }}
                  autoFocus
                />
                <label className="block text-xs font-medium text-gray-500 mb-1">Продукт (необязательно)</label>
                <select
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 mb-3"
                  value={addProductId === '' ? '' : addProductId}
                  onChange={(e) => setAddProductId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— не выбран —</option>
                  {productsForDirection.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-medium text-gray-500 mb-1">Старт (месяц)</label>
                <select
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 mb-3"
                  value={addMonthId === '' ? '' : addMonthId}
                  onChange={(e) => setAddMonthId(e.target.value ? Number(e.target.value) : '')}
                >
                  {months.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMonthShort(m.yearMonth)} ({m.yearMonth})
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-medium text-gray-500 mb-1">Окончание (необязательно)</label>
                <select
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 mb-4"
                  value={addEndMonthId === '' ? '' : addEndMonthId}
                  onChange={(e) => setAddEndMonthId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— один месяц —</option>
                  {months.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMonthShort(m.yearMonth)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
                    onClick={() => setShowAddModal(false)}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={addSaving || !addTitle.trim() || addMonthId === ''}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                    onClick={() => void submitAddEpic()}
                  >
                    {addSaving ? 'Создание…' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Detail panel */}
      {detailId != null
        ? createPortal(
            <EpicDetailPanel
              detailId={detailId}
              detail={detail}
              loading={detailLoading}
              months={months}
              products={products}
              onClose={closeDetail}
              onRefresh={() => {
                void load();
                if (detailId != null) {
                  api.getMvpItem(detailId).then((d) => setDetail(d as EpicDetail)).catch(() => {});
                }
              }}
              onDeleted={() => {
                closeDetail();
                void load();
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

/* ─── Epic detail (slide-over) ─── */
function EpicDetailPanel({
  detailId,
  detail,
  loading,
  months,
  products,
  onClose,
  onRefresh,
  onDeleted,
}: {
  detailId: number;
  detail: EpicDetail | null;
  loading: boolean;
  months: MvpMonth[];
  products: Product[];
  onClose: () => void;
  onRefresh: () => void;
  onDeleted: () => void;
}) {
  const [titleEdit, setTitleEdit] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<Task[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [createAssigneeId, setCreateAssigneeId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (detail) {
      setTitleVal(detail.title);
      setTitleEdit(false);
    }
  }, [detail]);

  useEffect(() => {
    if (!linkOpen) return;
    const t = window.setTimeout(() => {
      api.getTasks(linkQuery.trim() || undefined).then(setLinkResults).catch(() => setLinkResults([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [linkOpen, linkQuery]);

  useEffect(() => {
    if (createOpen) {
      api.getPeoplePublic().then(setPeople).catch(() => setPeople([]));
    }
  }, [createOpen]);

  const commitTitle = async () => {
    if (!detail) return;
    const v = titleVal.trim();
    setTitleEdit(false);
    if (!v || v === detail.title) return;
    setBusy(true);
    try {
      await api.updateMvpItem(detail.id, { title: v });
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (data: Record<string, unknown>) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.updateMvpItem(detail.id, data);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (taskId: number) => {
    setBusy(true);
    try {
      await api.unlinkTaskFromEpic(detailId, taskId);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const linkTask = async (taskId: number) => {
    setBusy(true);
    try {
      await api.linkTaskToEpic(detailId, taskId);
      setLinkOpen(false);
      setLinkQuery('');
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim() || createAssigneeId === '') return;
    setBusy(true);
    try {
      await api.createTaskPublic({
        title: newTaskTitle.trim(),
        priority: 'medium',
        assigneeIds: [Number(createAssigneeId)],
        mvpItemId: detailId,
        productId: detail?.productId ?? undefined,
        directionId: detail?.product?.directionId ?? undefined,
      });
      setNewTaskTitle('');
      setCreateOpen(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const removeEpic = async () => {
    if (!confirm('Удалить эпик? Связи с задачами будут сняты.')) return;
    setBusy(true);
    try {
      await api.deleteMvpItem(detailId);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/40 z-[170] backdrop-blur-[1px]"
        aria-label="Закрыть панель"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 bottom-0 z-[180] w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200 transition-transform duration-200 ease-out">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Эпик</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-red-500">Не удалось загрузить эпик.</p>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Название</p>
                {titleEdit ? (
                  <input
                    autoFocus
                    className="w-full rounded-xl border border-indigo-300 px-3 py-2 text-sm"
                    value={titleVal}
                    onChange={(e) => setTitleVal(e.target.value)}
                    onBlur={() => void commitTitle()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitTitle();
                      if (e.key === 'Escape') {
                        setTitleVal(detail.title);
                        setTitleEdit(false);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleVal(detail.title);
                      setTitleEdit(true);
                    }}
                    className="text-left w-full text-base font-bold text-gray-900 hover:text-indigo-700 border border-transparent hover:border-gray-200 rounded-xl px-2 py-1 -mx-2 transition-colors"
                  >
                    {detail.title}
                  </button>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Продукт</label>
                <select
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                  value={detail.productId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    void updateField({ productId: v ? Number(v) : null });
                  }}
                >
                  <option value="">— нет —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Старт</label>
                  <select
                    disabled={busy}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2 text-sm bg-gray-50"
                    value={detail.monthId}
                    onChange={(e) => void updateField({ monthId: Number(e.target.value) })}
                  >
                    {months.map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatMonthShort(m.yearMonth)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Окончание</label>
                  <select
                    disabled={busy}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2 text-sm bg-gray-50"
                    value={detail.endMonthId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      void updateField({ endMonthId: v ? Number(v) : null });
                    }}
                  >
                    <option value="">— нет —</option>
                    {months.map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatMonthShort(m.yearMonth)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Задачи</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLinkOpen((o) => !o)}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Привязать задачу
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateOpen((o) => !o)}
                      className="text-xs font-semibold text-violet-600 hover:underline"
                    >
                      Создать задачу
                    </button>
                  </div>
                </div>

                {linkOpen ? (
                  <div className="mb-3 p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 space-y-2">
                    <input
                      placeholder="Поиск задач…"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      value={linkQuery}
                      onChange={(e) => setLinkQuery(e.target.value)}
                    />
                    <ul className="max-h-36 overflow-y-auto space-y-1">
                      {linkResults
                        .filter((t) => !detail.tasks.some((x) => x.id === t.id))
                        .slice(0, 20)
                        .map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void linkTask(t.id)}
                              className="w-full text-left text-xs py-1.5 px-2 rounded-lg hover:bg-white border border-transparent hover:border-indigo-200"
                            >
                              {t.title}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {createOpen ? (
                  <div className="mb-3 p-3 rounded-xl bg-violet-50/80 border border-violet-100 space-y-2">
                    <input
                      placeholder="Название задачи"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                    <select
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      value={createAssigneeId === '' ? '' : createAssigneeId}
                      onChange={(e) => setCreateAssigneeId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Исполнитель…</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !newTaskTitle.trim() || createAssigneeId === ''}
                      onClick={() => void createTask()}
                      className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Создать и привязать
                    </button>
                  </div>
                ) : null}

                <ul className="space-y-2">
                  {detail.tasks.length === 0 ? (
                    <li className="text-sm text-gray-400 italic">Нет задач</li>
                  ) : (
                    detail.tasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 group"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-300'}`} />
                        <Link
                          to={`/tasks/${t.id}`}
                          className="flex-1 min-w-0 text-sm font-medium text-gray-900 hover:text-indigo-600 truncate"
                        >
                          {t.title}
                        </Link>
                        <span className="text-[10px] text-gray-500 shrink-0">{friendlyDeadline(t.deadline)}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void unlink(t.id)}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-70 group-hover:opacity-100"
                          title="Отвязать"
                        >
                          ×
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void removeEpic()}
                className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors"
              >
                Удалить эпик
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
