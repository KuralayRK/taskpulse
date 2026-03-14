import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Task, Person } from '../types';

const emptyForm = {
  title: '',
  description: '',
  deadline: '',
  priority: 'medium',
  assigneeId: '',
  status: 'todo',
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('tp_admin_key'));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'tasks' | 'people'>('tasks');

  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.login(password);
    if (res.ok) {
      localStorage.setItem('tp_admin_key', password);
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('Неверный пароль');
    }
  };

  const loadData = async () => {
    const [t, p] = await Promise.all([api.getTasks(), api.getPeople()]);
    setTasks(t);
    setPeople(p);
  };

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem('tp_admin_key');
    setAuthed(false);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title: form.title,
      description: form.description || null,
      deadline: form.deadline,
      priority: form.priority,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      status: form.status,
    };

    if (editingId) {
      await api.updateTask(editingId, data);
    } else {
      await api.createTask(data);
    }

    setForm({ ...emptyForm });
    setEditingId(null);
    loadData();
  };

  const handleEdit = (task: Task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      deadline: task.deadline.slice(0, 10),
      priority: task.priority,
      assigneeId: task.assigneeId ? String(task.assigneeId) : '',
      status: task.status,
    });
    setEditingId(task.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить задачу?')) return;
    await api.deleteTask(id);
    loadData();
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    await api.addPerson(newPersonName.trim(), newPersonEmail.trim() || undefined);
    setNewPersonName('');
    setNewPersonEmail('');
    loadData();
  };

  const handleDeletePerson = async (id: number) => {
    if (!confirm('Удалить этого человека?')) return;
    await api.deletePerson(id);
    loadData();
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-4 text-center">Вход в админку</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {authError && <p className="text-red-500 text-sm mb-3">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    todo: 'Не начато',
    in_progress: 'В работе',
    done: 'Готово',
  };

  const priorityLabel: Record<string, string> = {
    critical: 'Критичный',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
  };

  const deadlineColor = (deadline: string, status: string) => {
    if (status === 'done') return 'text-gray-400';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600 font-medium';
    if (days <= 7) return 'text-amber-600';
    return 'text-gray-600';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {(() => {
        const userName = localStorage.getItem('tp_user_name') || '';
        return userName ? (
          <div className="flex items-center gap-3 mb-4 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
            <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
              {userName[0]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-400">Управление</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
              Выйти
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold text-gray-900">Управление</h1>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
              Выйти
            </button>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('tasks')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'tasks' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Задачи ({tasks.length})
        </button>
        <button
          onClick={() => setTab('people')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'people' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Люди ({people.length})
        </button>
      </div>

      {tab === 'tasks' && (
        <>
          {/* Task form */}
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              {editingId ? 'Редактировать задачу' : 'Новая задача'}
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Название задачи"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <textarea
                placeholder="Описание (необязательно)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Дедлайн</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ответственный</label>
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Не назначен</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Приоритет</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критичный</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Статус</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="todo">Не начато</option>
                    <option value="in_progress">В работе</option>
                    <option value="done">Готово</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {editingId ? 'Сохранить' : 'Создать'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...emptyForm });
                    setEditingId(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Отмена
                </button>
              )}
            </div>
          </form>

          {/* Task list */}
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${
                  editingId === task.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{task.title}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                    <span className={deadlineColor(task.deadline, task.status)}>
                      {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                    {task.assignee && <span className="text-gray-400">{task.assignee.name}</span>}
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400">{statusLabel[task.status]}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400">{priorityLabel[task.priority]}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(task)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'people' && (
        <>
          {/* Add person form */}
          <form onSubmit={handleAddPerson} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Добавить человека</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Имя"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <input
                type="email"
                placeholder="Email (необязательно)"
                value={newPersonEmail}
                onChange={(e) => setNewPersonEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Добавить
              </button>
            </div>
          </form>

          {/* People list */}
          <div className="space-y-2">
            {people.map((person) => (
              <div
                key={person.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm flex items-center justify-center font-medium shrink-0">
                  {person.name[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{person.name}</div>
                  <div className="text-xs text-gray-400">
                    {person.email || 'нет email'}
                    {person._count && ` · ${person._count.tasks} задач`}
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePerson(person.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {people.length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">
                Добавьте людей, чтобы назначать им задачи
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
