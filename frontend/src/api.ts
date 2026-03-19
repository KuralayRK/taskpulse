/** Пустой / не задан → относительный `/api` (Vite прокси на :3001). Иначе полный URL до API. */
const BASE =
  typeof import.meta.env.VITE_API_BASE === 'string' && import.meta.env.VITE_API_BASE.trim()
    ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
    : '/api';

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
  _count?: { tasks: number; products?: number };
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  directionId: number;
  direction?: Direction;
  _count?: { mvpItems: number; tasks?: number };
}

export interface MvpItem {
  id: number;
  title: string;
  sortOrder: number;
  monthId: number;
  endMonthId: number | null;
  productId: number | null;
  product: (Product & { direction: Direction }) | null;
  _count?: { tasks: number };
  tasks?: { id: number; status: string }[];
}

export interface MvpMonth {
  id: number;
  yearMonth: string;
  subtitle: string;
  sortOrder: number;
  items: MvpItem[];
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
  productId?: number | null;
  product?: Product | null;
  mvpItemId?: number | null;
  mvpItem?: MvpItem | null;
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

  updatePerson: (id: number, data: { name?: string; email?: string | null }) =>
    fetch(`${BASE}/admin/people/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
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

  updateDirection: (id: number, name: string) =>
    fetch(`${BASE}/admin/directions/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ name }),
    }).then((r) => r.json()),

  deleteDirection: (id: number) =>
    fetch(`${BASE}/admin/directions/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  getProductsAdmin: (): Promise<Product[]> =>
    fetch(`${BASE}/admin/products`, {
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  createProductAdmin: (data: { name: string; directionId: number }): Promise<Product> =>
    fetch(`${BASE}/admin/products`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateProductAdmin: (id: number, data: Record<string, unknown>): Promise<Product> =>
    fetch(`${BASE}/admin/products/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteProductAdmin: (id: number) =>
    fetch(`${BASE}/admin/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey() },
    }).then((r) => r.json()),

  // ── MVP ────────────────────────────────────────
  getMvpHealth: async (): Promise<{ ok?: boolean; mvp?: boolean; error?: string }> => {
    try {
      const r = await fetch(`${BASE}/mvp/health`);
      const text = await r.text();
      try { return JSON.parse(text); } catch { return { error: `Не JSON (${r.status}): ${text.slice(0, 80)}` }; }
    } catch (e) { return { error: e instanceof Error ? e.message : 'Сеть недоступна' }; }
  },

  getMvpBoard: async (): Promise<{ months: MvpMonth[]; directions: Direction[]; products: Product[] }> => {
    const r = await fetch(`${BASE}/mvp/board`);
    const text = await r.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error('Ответ не JSON — запусти npm run dev'); }
    if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
    return { months: data.months || [], directions: data.directions || [], products: data.products || [] };
  },

  putMvpItemsOrder: (updates: { id: number; monthId: number; sortOrder: number }[]) =>
    fetch(`${BASE}/mvp/items/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    }).then((r) => r.json()),

  createMvpItem: (data: { title: string; monthId: number; endMonthId?: number | null; productId?: number | null }) =>
    fetch(`${BASE}/mvp/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateMvpItem: (id: number, data: Record<string, unknown>) =>
    fetch(`${BASE}/mvp/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteMvpItem: (id: number) =>
    fetch(`${BASE}/mvp/items/${id}`, { method: 'DELETE' }).then((r) => r.json()),

  getMvpItem: (id: number): Promise<MvpItem & { month: MvpMonth; endMonth: MvpMonth | null; tasks: Task[] }> =>
    fetch(`${BASE}/mvp/items/${id}`).then((r) => r.json()),

  linkTaskToEpic: (epicId: number, taskId: number) =>
    fetch(`${BASE}/mvp/items/${epicId}/link-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    }).then((r) => r.json()),

  unlinkTaskFromEpic: (epicId: number, taskId: number) =>
    fetch(`${BASE}/mvp/items/${epicId}/unlink-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    }).then((r) => r.json()),

  // ── Products ───────────────────────────────────
  getProducts: (): Promise<Product[]> =>
    fetch(`${BASE}/mvp/products`).then((r) => r.json()),

  createProduct: (data: { name: string; directionId: number }): Promise<Product> =>
    fetch(`${BASE}/mvp/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateProduct: (id: number, data: Record<string, unknown>): Promise<Product> =>
    fetch(`${BASE}/mvp/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteProduct: (id: number) =>
    fetch(`${BASE}/mvp/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
};
