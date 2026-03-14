import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Person } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyForm = {
  title: '',
  description: '',
  deadline: '',
  priority: 'medium',
  assigneeId: '',
};

export default function CreateTaskModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [people, setPeople] = useState<Person[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.getPeoplePublic().then(setPeople).catch(() => {});
      setForm({ ...emptyForm });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.deadline) return;
    setSaving(true);
    await api.createTaskPublic({
      title: form.title.trim(),
      description: form.description.trim() || null,
      deadline: form.deadline,
      priority: form.priority,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    });
    setSaving(false);
    onCreated();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto safe-bottom">
        <div className="sticky top-0 bg-white rounded-t-2xl sm:rounded-t-2xl border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">Новая задача</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Название *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Что нужно сделать?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Подробности (необязательно)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Дедлайн *</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Ответственный</label>
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">Не назначен</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Приоритет</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'low', label: 'Низкий', color: 'border-gray-200 text-gray-600 bg-gray-50' },
                { value: 'medium', label: 'Средний', color: 'border-blue-200 text-blue-700 bg-blue-50' },
                { value: 'high', label: 'Высокий', color: 'border-orange-200 text-orange-700 bg-orange-50' },
                { value: 'critical', label: 'Крит.', color: 'border-red-200 text-red-700 bg-red-50' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p.value })}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.priority === p.value
                      ? `${p.color} ring-2 ring-offset-1 ring-indigo-400`
                      : 'border-gray-200 text-gray-400 bg-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.deadline}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Создаю...' : 'Создать задачу'}
          </button>
        </form>
      </div>
    </div>
  );
}
