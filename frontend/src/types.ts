export interface Person {
  id: number;
  name: string;
  email: string | null;
  _count?: { tasks: number };
}

export interface Direction {
  id: number;
  name: string;
  _count?: { tasks: number };
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  startDate: string | null;
  deadline: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  directionId: number | null;
  direction: Direction | null;
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
