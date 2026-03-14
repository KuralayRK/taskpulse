import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import type { Task, Person, Direction } from '../types';

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('tp_admin_key'));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [tab, setTab] = useState<'tasks' | 'people' | 'directions'>('tasks');

  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val);
    }, 300);
  };

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

  const loadData = useCallback(async (q?: string) => {
    const [t, p, d] = await Promise.all([api.getTasks(q), api.getPeople(), api.getDirectionsAdmin()]);
    setTasks(t);
    setPeople(p);
    setDirections(d);
  }, []);

  useEffect(() => {
    if (authed) loadData(searchQuery || undefined);
  }, [authed, searchQuery, loadData]);

  useEffect(() => {
    const handler = () => { if (authed) loadData(searchQuery || undefined); };
    window.addEventListener('taskCreated', handler);
    return () => window.removeEventListener('taskCreated', handler);
  }, [authed, searchQuery, loadData]);

  const handleLogout = () => {
    localStorage.removeItem('tp_admin_key');
    setAuthed(false);
    setPassword('');
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

  const handleAddDirection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirName.trim()) return;
    await api.createDirection(newDirName.trim());
    setNewDirName('');
    loadData();
  };

  const handleDeleteDirection = async (id: number) => {
    if (!confirm('Удалить направление?')) return;
    await api.deleteDirection(id);
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

  const deadlineColor = (deadline: string | null, status: string) => {
    if (!deadline) return 'text-gray-400';
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
        {(['tasks', 'people', 'directions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'tasks' ? `Задачи (${tasks.length})` : t === 'people' ? `Люди (${people.length})` : `Направления (${directions.length})`}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="relative">
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
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{task.title}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  {task.deadline && (
                    <span className={deadlineColor(task.deadline, task.status)}>
                      {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {!task.deadline && <span className="text-gray-300">без срока</span>}
                  {task.assignees?.length > 0 && (
                    <span className="text-gray-400">{task.assignees.map((a) => a.name).join(', ')}</span>
                  )}
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-400">{statusLabel[task.status]}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-400">{priorityLabel[task.priority]}</span>
                  {task.direction && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-purple-500">{task.direction.name}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(task.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Удалить"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">Нет задач</p>
          )}
        </div>
      )}

      {tab === 'people' && (
        <>
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

      {tab === 'directions' && (
        <>
          <form onSubmit={handleAddDirection} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Добавить направление</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Название направления"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Добавить
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {directions.map((dir) => (
              <div
                key={dir.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm flex items-center justify-center font-medium shrink-0">
                  {dir.name[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{dir.name}</div>
                  <div className="text-xs text-gray-400">
                    {dir._count?.tasks ?? 0} задач
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDirection(dir.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {directions.length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">
                Нет направлений
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
