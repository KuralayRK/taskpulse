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

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
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
      <Link to={`/tasks/${task.id}`}>
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-lg leading-tight pr-2">{task.title}</h3>
          <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium shrink-0">
            {friendlyDeadline(task.deadline)}
          </span>
        </div>
        {task.assignee && (
          <div className="mt-2 flex items-center gap-2 text-white/80 text-sm">
            <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] flex items-center justify-center font-bold">
              {task.assignee.name[0]}
            </span>
            {task.assignee.name}
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
          <Link to={`/tasks/${task.id}`} className="text-sm text-white/60">
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
  const isOverdue = days < 0 && !isDone;
  const isSoon = days >= 0 && days <= 3 && !isDone;

  return (
    <Link
      to={`/tasks/${task.id}`}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 ${isDone ? 'opacity-50' : ''}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        isDone ? 'bg-gray-300' : isOverdue ? 'bg-red-500' : isSoon ? 'bg-amber-400' : 'bg-emerald-400'
      }`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {task.title}
        </span>
        {task.assignee && (
          <span className="text-xs text-gray-400 ml-2">{task.assignee.name}</span>
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
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(() => localStorage.getItem('tp_user_name') || '');
  const [filter, setFilter] = useState<string>('all');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const loadTasks = () => {
    api.getTasks().then((data) => {
      setTasks(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadTasks(); }, []);

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
  const myTasks = active.filter((t) => t.assignee?.name?.toLowerCase() === userName.toLowerCase());
  const myDone = done.filter((t) => t.assignee?.name?.toLowerCase() === userName.toLowerCase());
  const hotTasks = myTasks.filter((t) => daysUntil(t.deadline) <= 1).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));
  const myOther = myTasks.filter((t) => daysUntil(t.deadline) > 1).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));

  const assignees = Array.from(new Set(tasks.map((t) => t.assignee?.name).filter(Boolean))) as string[];
  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.assignee?.name === filter);
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
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white px-5 pt-8 pb-6 rounded-b-3xl shadow-xl shadow-indigo-600/20">
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
        {/* Hot tasks */}
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

        {/* My other tasks */}
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

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">Вся команда</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-3">
          <button
            onClick={() => setFilter('all')}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            Все ({tasks.length})
          </button>
          {assignees.map((name) => {
            const count = tasks.filter((t) => t.assignee?.name === name).length;
            const isMe = name.toLowerCase() === userName.toLowerCase();
            return (
              <button
                key={name}
                onClick={() => setFilter(filter === name ? 'all' : name)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === name
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {isMe ? `Я (${count})` : `${name} (${count})`}
              </button>
            );
          })}
        </div>

        {/* Team tasks */}
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
