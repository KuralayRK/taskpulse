import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Task, Direction } from '../types';

const laneColors = [
  { bar: '#a78bfa', barLight: '#ede9fe', label: 'bg-purple-100 text-purple-700' },
  { bar: '#38bdf8', barLight: '#e0f2fe', label: 'bg-sky-100 text-sky-700' },
  { bar: '#fbbf24', barLight: '#fef3c7', label: 'bg-amber-100 text-amber-700' },
  { bar: '#fb7185', barLight: '#ffe4e6', label: 'bg-rose-100 text-rose-700' },
  { bar: '#2dd4bf', barLight: '#ccfbf1', label: 'bg-teal-100 text-teal-700' },
  { bar: '#818cf8', barLight: '#e0e7ff', label: 'bg-indigo-100 text-indigo-700' },
];
const noColor = { bar: '#9ca3af', barLight: '#f3f4f6', label: 'bg-gray-100 text-gray-500' };

const WEEK_W = 120;
const BAR_H = 26;
const ROW_GAP = 4;
const LANE_PAD = 8;
const LABEL_W = 110;

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

export default function RoadmapPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLane, setExpandedLane] = useState<number | string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterNames, setFilterNames] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = () => {
    Promise.all([api.getTasks(), api.getDirections()]).then(([t, d]) => {
      setTasks(t); setDirections(d); setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    window.addEventListener('taskCreated', loadData);
    return () => window.removeEventListener('taskCreated', loadData);
  }, []);

  const allAssignees = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.assignees?.forEach((a) => s.add(a.name)));
    return Array.from(s).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filterNames.length > 0) {
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
  }, [tasks, filterNames, dateFrom, dateTo]);

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
        if (cM >= 0) mHeaders.push({ label: `${monthNames[cM]} ${cY}`, left: mS * WEEK_W, width: (i - mS) * WEEK_W });
        cM = w.month; cY = w.year; mS = i;
      }
    });
    if (cM >= 0) mHeaders.push({ label: `${monthNames[cM]} ${cY}`, left: mS * WEEK_W, width: (weekList.length - mS) * WEEK_W });

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
    return { lanes: lanesArr, weeks: weekList, timelineStart: firstMonday, timelineW: weekList.length * WEEK_W, todayX: (todayDays / 7) * WEEK_W, monthHeaders: mHeaders };
  }, [filtered, directions]);

  function computeLaneBars(lane: Lane): BarPos[] {
    const barMeta = lane.tasks.map((task) => {
      const s = getTaskStart(task); s.setHours(0, 0, 0, 0);
      const e = getTaskEnd(task); e.setHours(0, 0, 0, 0);
      const left = (daysBetween(timelineStart, s) / 7) * WEEK_W;
      const width = Math.max((Math.max(daysBetween(s, e), 1) / 7) * WEEK_W, 30);
      return { task, left, width };
    });
    const rows = computeRows(barMeta);
    return barMeta.map((b, i) => ({ ...b, row: rows[i] }));
  }

  function laneHeight(bars: BarPos[]): number {
    const maxRow = bars.length > 0 ? Math.max(...bars.map((b) => b.row)) : 0;
    return (maxRow + 1) * (BAR_H + ROW_GAP) + LANE_PAD * 2;
  }

  useEffect(() => {
    if (!loading && scrollRef.current && todayX > 0) {
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
    const key = id ?? 'none';
    setExpandedLane(expandedLane === key ? null : key);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
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

      {/* Filters */}
      <div className="px-4 mt-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterNames([])}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterNames.length === 0
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            Все
          </button>
          {allAssignees.map((name) => {
            const isActive = filterNames.includes(name);
            return (
              <button
                key={name}
                onClick={() => setFilterNames((prev) => isActive ? prev.filter((n) => n !== name) : [...prev, name])}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            placeholder="С"
          />
          <span className="text-gray-400 text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            placeholder="По"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
            >
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
          {/* Gantt chart: label + scrollable timeline side by side */}
          <div className="flex">
            {/* Fixed left labels column */}
            <div className="shrink-0 z-20 bg-white" style={{ width: LABEL_W }}>
              <div className="h-[52px] border-b border-gray-200 bg-gray-50" />
              {lanes.map((lane) => {
                const bars = computeLaneBars(lane);
                const h = laneHeight(bars);
                const laneKey = lane.id ?? 'none';
                const isOpen = expandedLane === laneKey;
                return (
                  <div
                    key={laneKey}
                    className="border-b border-gray-100 flex items-start cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ height: h }}
                    onClick={() => toggleLane(lane.id)}
                  >
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-br-lg ${lane.color.label} text-[11px] font-bold leading-tight`}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        viewBox="0 0 20 20" fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">{lane.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable timeline column */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-hide">
              <div style={{ width: timelineW, minWidth: '100%' }}>
                {/* Header: months + weeks */}
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
                          style={{ width: WEEK_W }}
                        >
                          {w.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Gantt bars per lane */}
                {lanes.map((lane) => {
                  const bars = computeLaneBars(lane);
                  const h = laneHeight(bars);
                  return (
                    <div
                      key={lane.id ?? 'none'}
                      className="relative border-b border-gray-100 cursor-pointer"
                      style={{ height: h }}
                      onClick={() => toggleLane(lane.id)}
                    >
                      <div className="absolute top-0 bottom-0 w-px bg-indigo-400/40 z-[2]" style={{ left: todayX }} />
                      {weeks.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: i * WEEK_W }} />
                      ))}
                      {bars.map(({ task, left, width, row }) => {
                        const isDone = task.status === 'done';
                        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isDone;
                        return (
                          <div
                            key={task.id}
                            className="absolute rounded-md overflow-hidden z-[3] pointer-events-none"
                            style={{
                              left, width,
                              top: LANE_PAD + row * (BAR_H + ROW_GAP),
                              height: BAR_H,
                              backgroundColor: isDone ? lane.color.barLight : isOverdue ? '#fecaca' : lane.color.bar,
                              opacity: isDone ? 0.5 : 1,
                            }}
                            title={task.title}
                          >
                            <div className="h-full flex items-center px-2 overflow-hidden">
                              <span className={`text-[10px] font-semibold truncate ${isDone ? 'text-gray-400 line-through' : isOverdue ? 'text-red-700' : 'text-white'}`}>
                                {task.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Expanded task list — OUTSIDE the flex, full width */}
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
    </div>
  );
}
