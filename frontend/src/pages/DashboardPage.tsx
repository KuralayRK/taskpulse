import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Task } from '../types';

function daysUntil(deadline: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function friendlyDeadline(deadline: string): string {
  const days = daysUntil(deadline);
  if (days < -1) return `${Math.abs(days)} дн. назад`;
  if (days === -1) return 'вчера';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days <= 7) return `через ${days} дн.`;
  return new Date(deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function CircleProgress({ percent, size = 80, color = '#4f46e5' }: { percent: number; size?: number; color?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  );
}

interface TeamMember {
  name: string;
  taskCount: number;
  overdueCount: number;
  soonCount: number;
  okCount: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const loadTasks = () => {
    api.getTasks().then((data) => {
      setTasks(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    window.addEventListener('taskCreated', loadTasks);
    return () => window.removeEventListener('taskCreated', loadTasks);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const active = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const overdue = active.filter((t) => daysUntil(t.deadline) < 0);
  const soon = active.filter((t) => { const d = daysUntil(t.deadline); return d >= 0 && d <= 7; });
  const ok = active.filter((t) => daysUntil(t.deadline) > 7);
  const healthPercent = active.length > 0 ? Math.round(((active.length - overdue.length) / active.length) * 100) : 100;
  const healthColor = healthPercent >= 70 ? '#10b981' : healthPercent >= 40 ? '#f59e0b' : '#ef4444';

  const teamMap = new Map<string, TeamMember>();
  active.forEach((t) => {
    const name = t.assignee?.name || 'Не назначен';
    const m = teamMap.get(name) || { name, taskCount: 0, overdueCount: 0, soonCount: 0, okCount: 0 };
    m.taskCount++;
    const d = daysUntil(t.deadline);
    if (d < 0) m.overdueCount++;
    else if (d <= 7) m.soonCount++;
    else m.okCount++;
    teamMap.set(name, m);
  });
  const team = Array.from(teamMap.values()).sort((a, b) => b.overdueCount - a.overdueCount || b.taskCount - a.taskCount);
  const maxTasks = Math.max(...team.map((m) => m.taskCount), 1);

  const attention = active
    .filter((t) => daysUntil(t.deadline) <= 1)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));

  // Task dates for calendar
  const tasksByDate = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const td = new Date(t.deadline);
    const key = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(t);
  });

  const alerts: { text: string; type: 'danger' | 'warning' }[] = [];
  team.forEach((m) => {
    if (m.overdueCount > 0) alerts.push({ text: `${m.name} — ${m.overdueCount} просроч.`, type: 'danger' });
  });
  team.forEach((m) => {
    if (m.taskCount >= 7) alerts.push({ text: `${m.name} — перегрузка (${m.taskCount} задач)`, type: 'warning' });
  });
  const unassigned = active.filter((t) => !t.assigneeId);
  if (unassigned.length > 0) alerts.push({ text: `${unassigned.length} без ответственного`, type: 'warning' });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900 text-white px-5 pb-6 rounded-b-3xl shadow-xl safe-top">
        {(() => {
          const userName = localStorage.getItem('tp_user_name') || '';
          const hour = new Date().getHours();
          const greet = hour < 6 ? '🌙 Доброй ночи' : hour < 12 ? '☀️ Доброе утро' : hour < 18 ? '👋 Добрый день' : '🌆 Добрый вечер';
          return userName ? (
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold">
                {userName[0]}
              </span>
              <div>
                <p className="text-xs text-slate-400">{greet}</p>
                <p className="text-sm font-semibold">{userName}</p>
              </div>
            </div>
          ) : null;
        })()}
        <h1 className="text-xl font-bold mb-5">
          {overdue.length > 0 ? '🔥 Есть горящие задачи' : '✅ Всё под контролем'}
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-3">
          {/* Health circle */}
          <div className="relative flex items-center justify-center shrink-0">
            <CircleProgress percent={healthPercent} size={72} color={healthColor} />
            <span className="absolute text-lg font-bold">{healthPercent}%</span>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <div className="text-xl font-bold text-red-400">{overdue.length}</div>
              <div className="text-[10px] text-slate-400">горит</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <div className="text-xl font-bold text-amber-400">{soon.length}</div>
              <div className="text-[10px] text-slate-400">скоро</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <div className="text-xl font-bold text-emerald-400">{ok.length}</div>
              <div className="text-[10px] text-slate-400">норма</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              ⚠️ Сигналы
            </h2>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.type === 'danger' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className={a.type === 'danger' ? 'text-red-700 font-medium' : 'text-amber-700'}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attention */}
        {attention.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Требует внимания ({attention.length})
            </h2>
            <div className="space-y-3">
              {attention.map((t) => {
                const isOverdue = daysUntil(t.deadline) < 0;
                return (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className={`block rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md ${
                      isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{t.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                        isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {friendlyDeadline(t.deadline)}
                      </span>
                    </div>
                    {t.assignee && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                          {t.assignee.name[0]}
                        </span>
                        {t.assignee.name}
                      </div>
                    )}
                    {t.lastComment && (
                      <div className="mt-2.5 bg-white/80 rounded-lg px-3 py-2 text-sm text-gray-600 border border-gray-100">
                        <span className="font-medium text-gray-700">{t.lastComment.authorName}:</span>{' '}
                        {t.lastComment.content.length > 80 ? t.lastComment.content.slice(0, 80) + '...' : t.lastComment.content}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Team */}
        <section className="mb-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">👥 Команда</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="space-y-4">
              {team.map((m) => (
                <div key={m.name}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      m.overdueCount > 0 ? 'bg-red-100 text-red-700' : m.soonCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {m.name[0]}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                        <div className="flex items-center gap-1.5">
                          {m.overdueCount > 0 && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                              {m.overdueCount} 🔥
                            </span>
                          )}
                          {m.soonCount > 0 && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                              {m.soonCount} ⏰
                            </span>
                          )}
                          {m.overdueCount === 0 && m.soonCount === 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-12 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex transition-all duration-700">
                      {m.overdueCount > 0 && (
                        <div className="bg-red-500 h-full" style={{ width: `${(m.overdueCount / maxTasks) * 100}%` }} />
                      )}
                      {m.soonCount > 0 && (
                        <div className="bg-amber-400 h-full" style={{ width: `${(m.soonCount / maxTasks) * 100}%` }} />
                      )}
                      {m.okCount > 0 && (
                        <div className="bg-emerald-400 h-full" style={{ width: `${(m.okCount / maxTasks) * 100}%` }} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Calendar */}
        <section className="mb-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">📅 Календарь</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {(() => {
              const { year, month } = calMonth;
              const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const startDow = (firstDay.getDay() + 6) % 7;
              const daysInMonth = lastDay.getDate();
              const today = new Date();
              const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const weeks: (number | null)[][] = [];
              let week: (number | null)[] = Array(startDow).fill(null);
              for (let d = 1; d <= daysInMonth; d++) {
                week.push(d);
                if (week.length === 7) { weeks.push(week); week = []; }
              }
              if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

              const prevMonth = () => setCalMonth(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
              const nextMonth = () => setCalMonth(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

              const selTasks = selectedDate ? (tasksByDate.get(selectedDate) || []) : [];

              return (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-800">{monthNames[month]} {year}</span>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                  </div>

                  <div className="px-3 py-2">
                    <div className="grid grid-cols-7 mb-1">
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                        <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
                      ))}
                    </div>
                    {weeks.map((w, wi) => (
                      <div key={wi} className="grid grid-cols-7">
                        {w.map((day, di) => {
                          if (day === null) return <div key={di} />;
                          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const dayTasks = tasksByDate.get(dateKey) || [];
                          const isToday = dateKey === todayKey;
                          const isSel = dateKey === selectedDate;
                          const hasOverdue = dayTasks.some((t) => t.status !== 'done' && daysUntil(t.deadline) < 0);
                          const hasTasks = dayTasks.length > 0;

                          return (
                            <button
                              key={di}
                              onClick={() => setSelectedDate(isSel ? null : dateKey)}
                              className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all ${
                                isSel
                                  ? 'bg-indigo-600 text-white'
                                  : isToday
                                    ? 'bg-indigo-50 text-indigo-600 font-bold'
                                    : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <span className={`text-sm ${isSel ? 'font-bold' : ''}`}>{day}</span>
                              {hasTasks && (
                                <div className="flex gap-0.5 mt-0.5">
                                  {dayTasks.slice(0, 3).map((t, i) => (
                                    <span
                                      key={i}
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isSel ? 'bg-white/70'
                                          : hasOverdue ? 'bg-red-500'
                                            : t.status === 'done' ? 'bg-gray-300'
                                              : 'bg-indigo-500'
                                      }`}
                                    />
                                  ))}
                                  {dayTasks.length > 3 && (
                                    <span className={`text-[8px] ${isSel ? 'text-white/70' : 'text-gray-400'}`}>+{dayTasks.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {selectedDate && (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}{selTasks.length} {selTasks.length === 1 ? 'задача' : 'задач'}
                      </p>
                      {selTasks.length > 0 ? (
                        <div className="space-y-2">
                          {selTasks.map((t) => (
                            <Link
                              key={t.id}
                              to={`/tasks/${t.id}`}
                              className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors"
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                t.status === 'done' ? 'bg-gray-300' : t.priority === 'critical' || t.priority === 'high' ? 'bg-red-500' : 'bg-indigo-400'
                              }`} />
                              <span className={`truncate ${t.status === 'done' ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                              {t.assignee && <span className="text-xs text-gray-400 shrink-0">({t.assignee.name})</span>}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300">Нет задач на эту дату</p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{tasks.length}</div>
            <div className="text-[10px] text-gray-400 mt-1">всего задач</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{done.length}</div>
            <div className="text-[10px] text-gray-400 mt-1">завершено</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{team.length}</div>
            <div className="text-[10px] text-gray-400 mt-1">в команде</div>
          </div>
        </div>
      </div>
    </div>
  );
}
