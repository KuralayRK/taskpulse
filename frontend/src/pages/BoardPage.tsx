import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Task, Direction } from '../types';

function daysUntil(deadline: string | null): number {
  if (!deadline) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function friendlyDeadline(deadline: string | null): string {
  if (!deadline) return 'без срока';
  const days = daysUntil(deadline);
  if (days < -1) return `${Math.abs(days)} дн. назад`;
  if (days === -1) return 'вчера';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days <= 7) return `через ${days} дн.`;
  return new Date(deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function assigneeNames(task: Task): string {
  if (!task.assignees?.length) return '';
  return task.assignees.map((a) => a.name).join(', ');
}

function isAssigned(task: Task, name: string): boolean {
  return task.assignees?.some((a) => a.name.toLowerCase() === name.toLowerCase()) || false;
}

function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6">👋</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать!</h1>
        <p className="text-gray-500 mb-8">Введите имя, чтобы увидеть свои задачи</p>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя..."
            className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg text-center focus:outline-none focus:border-indigo-500 transition-colors mb-4"
            autoFocus
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-30 transition-all"
          >
            Начать
          </button>
        </form>
      </div>
    </div>
  );
}

function HotTaskCard({ task, userName, onCommentAdded }: { task: Task; userName: string; onCommentAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!comment.trim()) return;
    setSending(true);
    await api.addComment(task.id, comment.trim(), userName);
    setComment('');
    setShowForm(false);
    setSending(false);
    onCommentAdded();
  };

  const days = daysUntil(task.deadline);
  const isOverdue = days < 0;

  return (
    <div className={`rounded-2xl p-5 ${isOverdue ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-amber-400 to-orange-400'} text-white shadow-lg ${isOverdue ? 'shadow-red-500/30' : 'shadow-amber-400/30'}`}>
      <Link to={`/tasks/${task.id}`} state={{ from: '/board' }}>
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-lg leading-tight pr-2">{task.title}</h3>
          <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium shrink-0">
            {friendlyDeadline(task.deadline)}
          </span>
        </div>
        {task.assignees?.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-white/80 text-sm">
            <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] flex items-center justify-center font-bold">
              {task.assignees[0].name[0]}
            </span>
            {assigneeNames(task)}
          </div>
        )}
      </Link>

      {task.lastComment && (
        <div className="mt-3 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm text-white/90">
          <span className="font-semibold">{task.lastComment.authorName}:</span>{' '}
          {task.lastComment.content.length > 80
            ? task.lastComment.content.slice(0, 80) + '...'
            : task.lastComment.content}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl font-medium transition-colors"
        >
          {showForm ? 'Скрыть' : '💬 Комментировать'}
        </button>
        {(task._count?.comments ?? 0) > 0 && (
          <Link to={`/tasks/${task.id}`} state={{ from: '/board' }} className="text-sm text-white/60">
            {task._count?.comments} {plural(task._count?.comments ?? 0, 'комментарий', 'комментария', 'комментариев')}
          </Link>
        )}
      </div>

      {showForm && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Написать..."
            className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/30"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={sending || !comment.trim()}
            className="bg-white text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:shadow-md"
          >
            {sending ? '...' : '→'}
          </button>
        </div>
      )}
    </div>
  );
}

function CompactTaskRow({ task }: { task: Task }) {
  const days = daysUntil(task.deadline);
  const isDone = task.status === 'done';
  const hasDeadline = !!task.deadline;
  const isOverdue = hasDeadline && days < 0 && !isDone;
  const isSoon = hasDeadline && days >= 0 && days <= 3 && !isDone;

  return (
    <Link
      to={`/tasks/${task.id}`}
      state={{ from: '/board' }}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 ${isDone ? 'opacity-50' : ''}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        isDone ? 'bg-gray-300' : isOverdue ? 'bg-red-500' : isSoon ? 'bg-amber-400' : 'bg-emerald-400'
      }`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {task.title}
        </span>
        {task.assignees?.length > 0 && (
          <span className="text-xs text-gray-400 ml-2">{assigneeNames(task)}</span>
        )}
      </div>
      <span className={`text-xs shrink-0 font-medium ${
        isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-gray-400'
      }`}>
        {friendlyDeadline(task.deadline)}
      </span>
      {(task._count?.comments ?? 0) > 0 && (
        <span className="text-xs text-gray-300">💬{task._count?.comments}</span>
      )}
    </Link>
  );
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(() => localStorage.getItem('tp_user_name') || '');
  const [filterNames, setFilterNames] = useState<string[]>([]);
  const [filterDirs, setFilterDirs] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const loadTasks = useCallback((q?: string) => {
    Promise.all([api.getTasks(q), api.getDirections()]).then(([t, d]) => {
      setTasks(t); setDirections(d); setLoading(false);
    });
  }, []);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val);
      loadTasks(val || undefined);
    }, 300);
  };

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    const handler = () => loadTasks(searchQuery || undefined);
    window.addEventListener('taskCreated', handler);
    return () => window.removeEventListener('taskCreated', handler);
  }, [loadTasks, searchQuery]);

  const handleSetName = (name: string) => {
    localStorage.setItem('tp_user_name', name);
    setUserName(name);
  };

  if (!userName) return <NamePrompt onSubmit={handleSetName} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const active = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const myTasks = active.filter((t) => isAssigned(t, userName));
  const myDone = done.filter((t) => isAssigned(t, userName));
  const hotTasks = myTasks.filter((t) => t.deadline && daysUntil(t.deadline) <= 1).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));
  const myOther = myTasks.filter((t) => !t.deadline || daysUntil(t.deadline) > 1).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));

  const assigneeSet = new Set<string>();
  tasks.forEach((t) => t.assignees?.forEach((a) => assigneeSet.add(a.name)));
  const assignees = Array.from(assigneeSet).sort();
  const filteredTasks = tasks.filter((t) => {
    if (filterNames.length > 0 && !t.assignees?.some((a) => filterNames.includes(a.name))) return false;
    if (filterDirs.length > 0 && (!t.directionId || !filterDirs.includes(t.directionId))) return false;
    return true;
  });
  const totalMyTasks = myTasks.length + myDone.length;
  const myProgress = totalMyTasks > 0 ? Math.round((myDone.length / totalMyTasks) * 100) : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '🌙 Доброй ночи';
    if (hour < 12) return '☀️ Доброе утро';
    if (hour < 18) return '👋 Добрый день';
    return '🌆 Добрый вечер';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white px-5 pb-6 rounded-b-3xl shadow-xl shadow-indigo-600/20 safe-top">
        <div className="flex items-center justify-between mb-4">
          {editingName ? (
            <form
              className="flex items-center gap-2 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) {
                  handleSetName(newName.trim());
                  setEditingName(false);
                }
              }}
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Новое имя..."
                className="flex-1 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white placeholder-white/50 focus:outline-none"
                autoFocus
              />
              <button type="submit" className="bg-white text-indigo-600 px-3 py-2 rounded-xl text-sm font-semibold">OK</button>
              <button type="button" onClick={() => setEditingName(false)} className="text-white/60 text-sm px-2 py-2">Отмена</button>
            </form>
          ) : (
            <>
              <div>
                <p className="text-sm text-indigo-200">{greeting()}</p>
                <h1 className="text-2xl font-bold mt-0.5">{userName}</h1>
              </div>
              <button
                onClick={() => { setNewName(userName); setEditingName(true); }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold hover:bg-white/20 transition-colors"
                title="Сменить имя"
              >
                {userName[0]}
              </button>
            </>
          )}
        </div>

        {myTasks.length > 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-indigo-200">
                {myTasks.length} {plural(myTasks.length, 'задача', 'задачи', 'задач')} в работе
              </span>
              {totalMyTasks > 0 && (
                <span className="text-sm font-bold">{myProgress}%</span>
              )}
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${myProgress}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-4 mt-5">
        {hotTasks.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Требует внимания
            </h2>
            <div className="space-y-3">
              {hotTasks.map((t) => (
                <HotTaskCard key={t.id} task={t} userName={userName} onCommentAdded={loadTasks} />
              ))}
            </div>
          </section>
        )}

        {myOther.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Мои задачи</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {myOther.map((t) => (
                <CompactTaskRow key={t.id} task={t} />
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">Вся команда</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="relative mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск по названию, описанию, комментариям..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setFilterNames([])}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filterNames.length === 0
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            Все ({tasks.length})
          </button>
          {assignees.map((name) => {
            const count = tasks.filter((t) => t.assignees?.some((a) => a.name === name)).length;
            const isMe = name.toLowerCase() === userName.toLowerCase();
            const isActive = filterNames.includes(name);
            return (
              <button
                key={name}
                onClick={() => setFilterNames((prev) => isActive ? prev.filter((n) => n !== name) : [...prev, name])}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {isMe ? `Я (${count})` : `${name} (${count})`}
              </button>
            );
          })}
        </div>

        {directions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mt-2 mb-3">
            {directions.map((dir) => {
              const isActive = filterDirs.includes(dir.id);
              return (
                <button
                  key={dir.id}
                  onClick={() => setFilterDirs((prev) => isActive ? prev.filter((d) => d !== dir.id) : [...prev, dir.id])}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-purple-600 border border-purple-200 hover:border-purple-300'
                  }`}
                >
                  {dir.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100 mb-6">
          {filteredTasks
            .sort((a, b) => {
              if (a.status === 'done' && b.status !== 'done') return 1;
              if (a.status !== 'done' && b.status === 'done') return -1;
              return daysUntil(a.deadline) - daysUntil(b.deadline);
            })
            .map((t) => (
              <CompactTaskRow key={t.id} task={t} />
            ))}
        </div>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl">🔍</span>
            <p className="text-gray-400 mt-3">Нет задач</p>
          </div>
        )}
      </div>
    </div>
  );
}
