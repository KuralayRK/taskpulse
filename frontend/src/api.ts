const BASE = '/api';

function adminKey(): string {
  return localStorage.getItem('tp_admin_key') || '';
}

function adminHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-admin-key': adminKey() };
}

export const api = {
  getTasks: () => fetch(`${BASE}/tasks`).then((r) => r.json()),

  getTask: (id: number) => fetch(`${BASE}/tasks/${id}`).then((r) => r.json()),

  getPeoplePublic: () => fetch(`${BASE}/people`).then((r) => r.json()),

  createTaskPublic: (data: Record<string, unknown>) =>
    fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateTaskPublic: (id: number, data: Record<string, unknown>) =>
    fetch(`${BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  addComment: (taskId: number, content: string, authorName: string) =>
    fetch(`${BASE}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, authorName }),
    }).then((r) => r.json()),

  login: (password: string) =>
    fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),

  createTask: (data: Record<string, unknown>) =>
    fetch(`${BASE}/admin/tasks`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateTask: (id: number, data: Record<string, unknown>) =>
    fetch(`${BASE}/admin/tasks/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteTask: (id: number) =>
    fetch(`${BASE}/admin/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  getPeople: () =>
    fetch(`${BASE}/admin/people`, {
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  addPerson: (name: string, email?: string) =>
    fetch(`${BASE}/admin/people`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ name, email }),
    }).then((r) => r.json()),

  deletePerson: (id: number) =>
    fetch(`${BASE}/admin/people/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),
};
