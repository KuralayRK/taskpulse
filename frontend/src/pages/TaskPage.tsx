import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import type { Task, Person } from '../types';

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

type EditingField = 'title' | 'description' | 'deadline' | 'status' | null;

export default function TaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string })?.from || '/board';
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const [editingAssignees, setEditingAssignees] = useState(false);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);

  const userName = localStorage.getItem('tp_user_name') || '';

  const load = () => {
    api.getTask(Number(id)).then((data) => {
      setTask(data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && editingField !== 'status') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editingField]);

  const startEdit = (field: EditingField) => {
    if (!task || !field) return;
    switch (field) {
      case 'title': setEditValue(task.title); break;
      case 'description': setEditValue(task.description || ''); break;
      case 'deadline': setEditValue(task.deadline ? task.deadline.slice(0, 10) : ''); break;
      case 'status': setEditValue(task.status); break;
    }
    setEditingField(field);
  };

  const saveField = async () => {
    if (!task || !editingField) return;
    const data: Record<string, unknown> = {};
    switch (editingField) {
      case 'title':
        if (!editValue.trim()) { cancelEdit(); return; }
        data.title = editValue.trim();
        break;
      case 'description':
        data.description = editValue.trim() || null;
        break;
      case 'deadline':
        data.deadline = editValue || null;
        break;
      case 'status':
        data.status = editValue;
        break;
    }
    setEditingField(null);
    await api.updateTaskPublic(Number(id), data);
    load();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveField(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !userName) return;
    setSending(true);
    await api.addComment(Number(id), comment.trim(), userName);
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
        <span className="text-4xl">🔍</span>
        <p className="text-gray-500 mt-3">Задача не найдена</p>
        <button onClick={() => navigate(backTo)} className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Назад
        </button>
      </div>
    );
  }

  const hasDeadline = !!task.deadline;
  const deadlineDate = hasDeadline ? new Date(task.deadline!) : null;
  const now = new Date();
  const isOverdue = deadlineDate ? deadlineDate < now && task.status !== 'done' : false;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => navigate(backTo)} className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Назад
      </button>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        {editingField === 'title' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveField}
            onKeyDown={handleKeyDown}
            className="w-full text-xl font-bold text-gray-900 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ) : (
          <h1
            onClick={() => startEdit('title')}
            className="text-xl font-bold text-gray-900 mb-3 cursor-pointer rounded-lg px-3 py-1.5 -mx-3 hover:bg-gray-50 transition-colors"
          >
            {task.title}
          </h1>
        )}

        {editingField === 'description' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveField}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Добавить описание..."
            className="w-full text-gray-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        ) : (
          <p
            onClick={() => startEdit('description')}
            className="text-gray-600 mb-4 leading-relaxed text-sm cursor-pointer rounded-lg px-3 py-2 -mx-3 hover:bg-gray-50 transition-colors min-h-[2rem]"
          >
            {task.description || <span className="text-gray-300 italic">Нажмите, чтобы добавить описание...</span>}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {editingField === 'status' ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); }}
              onBlur={saveField}
              className="text-xs px-2.5 py-1 rounded-full font-medium border border-indigo-200 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todo">Не начато</option>
              <option value="in_progress">В работе</option>
              <option value="done">Готово</option>
            </select>
          ) : (
            <span
              onClick={() => startEdit('status')}
              className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer hover:ring-2 hover:ring-indigo-200 transition-all ${statusStyle[task.status]}`}
            >
              {statusLabel[task.status]}
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityStyle[task.priority]}`}>
            {priorityLabel[task.priority]}
          </span>
          {task.direction && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
              {task.direction.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Ответственные</span>
            {editingAssignees ? (
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {allPeople.map((p) => {
                    const isSelected = selectedAssigneeIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedAssigneeIds((prev) =>
                          isSelected ? prev.filter((i) => i !== p.id) : [...prev, p.id]
                        )}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (selectedAssigneeIds.length > 0) {
                        await api.updateTaskPublic(Number(id), { assigneeIds: selectedAssigneeIds });
                        load();
                      }
                      setEditingAssignees(false);
                    }}
                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg font-medium"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setEditingAssignees(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={async () => {
                  if (allPeople.length === 0) {
                    const p = await api.getPeoplePublic();
                    setAllPeople(p);
                  }
                  setSelectedAssigneeIds(task.assignees?.map((a) => a.id) || []);
                  setEditingAssignees(true);
                }}
                className="mt-1 cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
              >
                {task.assignees?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignees.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                          {a.name[0]}
                        </span>
                        {a.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-gray-300 italic">Нажмите, чтобы назначить...</p>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="text-gray-400 text-xs">Дедлайн</span>
            {editingField === 'deadline' ? (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveField}
                onKeyDown={handleKeyDown}
                className="w-full font-medium mt-0.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <p
                onClick={() => startEdit('deadline')}
                className={`font-medium mt-0.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}
              >
                {deadlineDate
                  ? deadlineDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                  : <span className="text-gray-300 italic">без срока</span>
                }
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="mt-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
          Комментарии ({task.comments?.length || 0})
        </h2>

        {task.comments && task.comments.length > 0 ? (
          <div className="space-y-3 mb-6">
            {task.comments.map((c: any) => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                    {c.authorName[0]}
                  </span>
                  <span className="font-semibold text-sm text-gray-800">{c.authorName}</span>
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
          <div className="text-center py-8 mb-6">
            <span className="text-3xl">💬</span>
            <p className="text-gray-400 text-sm mt-2">Пока нет комментариев</p>
          </div>
        )}

        {userName ? (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                {userName[0]}
              </span>
              <span>от <span className="font-medium text-gray-700">{userName}</span></span>
            </div>
            <div className="flex gap-2">
              <textarea
                placeholder="Написать комментарий..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                required
              />
              <button
                type="submit"
                disabled={sending || !comment.trim()}
                className="self-end bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
              >
                {sending ? '...' : '→'}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-gray-500 text-sm mb-2">Чтобы комментировать, представьтесь</p>
            <Link to="/board" className="text-indigo-600 text-sm font-medium hover:underline">
              Перейти на доску →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
