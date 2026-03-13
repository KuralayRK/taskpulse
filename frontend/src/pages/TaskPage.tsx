import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Task } from '../types';

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

const statusStyle: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
};

export default function TaskPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => localStorage.getItem('tp_user_name') || '');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    api.getTask(Number(id)).then((data) => {
      setTask(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !name.trim()) return;
    setSending(true);
    localStorage.setItem('tp_user_name', name);
    await api.addComment(Number(id), comment.trim(), name.trim());
    setComment('');
    setSending(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Задача не найдена</p>
        <Link to="/" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← На доску
        </Link>
      </div>
    );
  }

  const deadlineDate = new Date(task.deadline);
  const now = new Date();
  const isOverdue = deadlineDate < now && task.status !== 'done';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">
        ← На доску
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-3">{task.title}</h1>

        {task.description && (
          <p className="text-gray-600 mb-4 leading-relaxed">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyle[task.status]}`}>
            {statusLabel[task.status]}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityStyle[task.priority]}`}>
            {priorityLabel[task.priority]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Ответственный</span>
            <p className="font-medium text-gray-700 mt-0.5">
              {task.assignee ? task.assignee.name : '—'}
            </p>
          </div>
          <div>
            <span className="text-gray-400">Дедлайн</span>
            <p className={`font-medium mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
              {deadlineDate.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Комментарии ({task.comments?.length || 0})
        </h2>

        {task.comments && task.comments.length > 0 ? (
          <div className="space-y-3 mb-6">
            {task.comments.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-medium">
                    {c.authorName[0]}
                  </span>
                  <span className="font-medium text-sm text-gray-800">{c.authorName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-6">Пока нет комментариев</p>
        )}

        {/* Comment form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4">
          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          <textarea
            placeholder="Написать комментарий..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            required
          />
          <button
            type="submit"
            disabled={sending || !comment.trim() || !name.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  );
}
