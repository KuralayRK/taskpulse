const BASE = '/api';

function adminKey(): string {
  return localStorage.getItem('tp_admin_key') || '';
}

function adminHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-admin-key': adminKey() };
}

export interface Person {
  id: number;
  name: string;
  email?: string | null;
}

export interface Direction {
  id: number;
  name: string;
  _count?: { tasks: number };
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  status: string;
  priority: string;
  directionId?: number | null;
  direction?: Direction | null;
  assignees: Person[];
  _count?: { comments: number };
  lastComment?: { content: string; authorName: string; createdAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  getTasks: (search?: string): Promise<Task[]> => {
    const url = search ? `${BASE}/tasks?q=${encodeURIComponent(search)}` : `${BASE}/tasks`;
    return fetch(url).then((r) => r.json());
  },

  getTask: (id: number): Promise<Task & { comments: any[] }> =>
    fetch(`${BASE}/tasks/${id}`).then((r) => r.json()),

  getPeoplePublic: (): Promise<Person[]> => fetch(`${BASE}/people`).then((r) => r.json()),

  getDirections: (): Promise<Direction[]> => fetch(`${BASE}/directions`).then((r) => r.json()),

  createDirection: (name: string): Promise<Direction> =>
    fetch(`${BASE}/directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()),

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

  getDirectionsAdmin: (): Promise<Direction[]> =>
    fetch(`${BASE}/admin/directions`, {
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  deleteDirection: (id: number) =>
    fetch(`${BASE}/admin/directions/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),
};
