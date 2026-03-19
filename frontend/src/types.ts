export interface Person {
  id: number;
  name: string;
  email?: string | null;
  _count?: { tasks: number };
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
  mvpItem?: { id: number; title: string } | null;
  assignees: Person[];
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number };
  lastComment?: { content: string; authorName: string; createdAt: string } | null;
  comments?: Comment[];
}

export interface Comment {
  id: number;
  content: string;
  authorName: string;
  taskId: number;
  createdAt: string;
}
