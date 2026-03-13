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

function formatDeadline(deadline: string): string {
  const days = daysUntil(deadline);
  const date = new Date(deadline).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  if (days < -1) return `просрочено ${Math.abs(days)} дн. (${date})`;
  if (days === -1) return `просрочено вчера (${date})`;
  if (days === 0) return `сегодня (${date})`;
  if (days === 1) return `завтра (${date})`;
  if (days <= 7) return `через ${days} дн. (${date})`;
  return date;
}

const priorityLabel: Record<string, string> = {
  critical: 'Критичный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const priorityStyle: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

const statusLabel: Record<string, string> = {
  todo: 'Не начато',
  in_progress: 'В работе',
  done: 'Готово',
};

function TaskCard({ task }: { task: Task }) {
  const days = daysUntil(task.deadline);
  const isOverdue = days < 0 && task.status !== 'done';
  const isSoon = days >= 0 && days <= 7 && task.status !== 'done';

  return (
    <Link
      to={`/tasks/${task.id}`}
      className={`block rounded-xl border p-4 transition-all hover:shadow-md ${
        isOverdue
          ? 'border-red-200 bg-red-50/50'
          : isSoon
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-tight">{task.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priorityStyle[task.priority]}`}>
          {priorityLabel[task.priority]}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
        {task.assignee && (
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-medium">
              {task.assignee.name[0]}
            </span>
            {task.assignee.name}
          </span>
        )}
        <span className={isOverdue ? 'text-red-600 font-medium' : isSoon ? 'text-amber-600 font-medium' : ''}>
          {formatDeadline(task.deadline)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">{statusLabel[task.status]}</span>
        {(task._count?.comments ?? 0) > 0 && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2z" clipRule="evenodd" />
            </svg>
            {task._count?.comments}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTasks().then((data) => {
      setTasks(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const active = tasks.filter((t) => t.status !== 'done');
  const overdue = active.filter((t) => daysUntil(t.deadline) < 0);
  const soon = active.filter((t) => {
    const d = daysUntil(t.deadline);
    return d >= 0 && d <= 7;
  });
  const ok = active.filter((t) => daysUntil(t.deadline) > 7);
  const done = tasks.filter((t) => t.status === 'done');

  const healthPercent = active.length > 0 ? Math.round(((active.length - overdue.length) / active.length) * 100) : 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{overdue.length}</div>
          <div className="text-xs text-red-500">Просрочено</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{soon.length}</div>
          <div className="text-xs text-amber-500">Скоро</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{ok.length}</div>
          <div className="text-xs text-emerald-500">В норме</div>
        </div>
      </div>

      {/* Health bar */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">Здоровье команды</span>
          <span className={`text-sm font-bold ${healthPercent >= 70 ? 'text-emerald-600' : healthPercent >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
            {healthPercent}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${healthPercent >= 70 ? 'bg-emerald-500' : healthPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Просрочено ({overdue.length})
          </h2>
          <div className="space-y-3">
            {overdue.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {/* Soon */}
      {soon.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Скоро дедлайн ({soon.length})
          </h2>
          <div className="space-y-3">
            {soon.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {/* OK */}
      {ok.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            В норме ({ok.length})
          </h2>
          <div className="space-y-3">
            {ok.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {/* Done */}
      {done.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Завершено ({done.length})
          </h2>
          <div className="space-y-3">
            {done.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Пока нет задач</p>
          <p className="text-sm mt-1">Добавьте первую задачу через админку</p>
        </div>
      )}
    </div>
  );
}
