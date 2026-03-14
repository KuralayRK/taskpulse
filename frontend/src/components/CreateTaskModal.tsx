import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Person, Direction } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [directionId, setDirectionId] = useState<string>('');
  const [newDirName, setNewDirName] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([api.getPeoplePublic(), api.getDirections()]).then(([p, d]) => {
        setPeople(p);
        setDirections(d);
      });
      setTitle('');
      setDescription('');
      setStartDate('');
      setDeadline('');
      setPriority('medium');
      setSelectedPeople([]);
      setDirectionId('');
      setNewDirName('');
    }
  }, [open]);

  const togglePerson = (id: number) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  };

  const canSubmit = title.trim() && selectedPeople.length > 0 && priority;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.createTaskPublic({
        title: title.trim(),
        description: description.trim() || null,
        startDate: startDate || null,
        deadline: deadline || null,
        priority,
        assigneeIds: selectedPeople,
        directionId: directionId === '__new__' ? null : (directionId ? Number(directionId) : null),
        directionName: directionId === '__new__' ? newDirName.trim() : null,
      });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробности (необязательно)"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Начало</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Дедлайн</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Ответственные * <span className="text-gray-400">(до 4)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const active = selectedPeople.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    } ${!active && selectedPeople.length >= 4 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!active && selectedPeople.length >= 4}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            {selectedPeople.length === 0 && (
              <p className="text-xs text-red-400 mt-1">Выберите хотя бы одного</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Направление</label>
            <select
              value={directionId}
              onChange={(e) => setDirectionId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">Без направления</option>
              {directions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
              <option value="__new__">+ Создать новое...</option>
            </select>
            {directionId === '__new__' && (
              <input
                type="text"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="Название направления"
                className="w-full mt-2 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Приоритет *</label>
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
                  onClick={() => setPriority(p.value)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    priority === p.value
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
            disabled={saving || !canSubmit}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Создаю...' : 'Создать задачу'}
          </button>
        </form>
      </div>
    </div>
  );
}
