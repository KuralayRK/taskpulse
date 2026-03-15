import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];
  if (key !== (process.env.ADMIN_PASSWORD || 'admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'admin')) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

router.use(adminAuth);

// --- Export (скачать все данные перед переходом на Postgres) ---
router.get('/export', async (_req: Request, res: Response) => {
  try {
    const [people, directions, tasks, taskAssignees, comments] = await Promise.all([
      prisma.person.findMany({ orderBy: { id: 'asc' } }),
      prisma.direction.findMany({ orderBy: { id: 'asc' } }),
      prisma.task.findMany({ orderBy: { id: 'asc' } }),
      prisma.taskAssignee.findMany({ orderBy: { id: 'asc' } }),
      prisma.comment.findMany({ orderBy: { id: 'asc' } }),
    ]);
    res.setHeader('Content-Disposition', 'attachment; filename="taskpulse-backup.json"');
    res.json({ people, directions, tasks, taskAssignees, comments, exportedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// --- Import (загрузить бэкап в новую БД после перехода на Postgres) ---
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { people, directions, tasks, taskAssignees, comments } = req.body as {
      people?: Array<{ id: number; name: string; email?: string | null }>;
      directions?: Array<{ id: number; name: string }>;
      tasks?: Array<{ id: number; title: string; description?: string | null; startDate?: string | null; deadline?: string | null; status: string; priority: string; directionId?: number | null; createdAt?: string; updatedAt?: string }>;
      taskAssignees?: Array<{ id: number; taskId: number; personId: number }>;
      comments?: Array<{ id: number; content: string; authorName: string; taskId: number; createdAt?: string }>;
    };
    if (!people || !Array.isArray(people)) return res.status(400).json({ error: 'Invalid backup: people required' });

    const personOldToNew = new Map<number, number>();
    const directionOldToNew = new Map<number, number>();
    const taskOldToNew = new Map<number, number>();

    await prisma.comment.deleteMany();
    await prisma.taskAssignee.deleteMany();
    await prisma.task.deleteMany();
    await prisma.direction.deleteMany();
    await prisma.person.deleteMany();

    for (const p of people) {
      const created = await prisma.person.create({ data: { name: p.name, email: p.email ?? null } });
      personOldToNew.set(p.id, created.id);
    }
    for (const d of directions || []) {
      const created = await prisma.direction.create({ data: { name: d.name } });
      directionOldToNew.set(d.id, created.id);
    }
    for (const t of tasks || []) {
      const newDirId = t.directionId != null ? directionOldToNew.get(t.directionId) ?? null : null;
      const created = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description ?? null,
          startDate: t.startDate ? new Date(t.startDate) : null,
          deadline: t.deadline ? new Date(t.deadline) : null,
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          directionId: newDirId,
        },
      });
      taskOldToNew.set(t.id, created.id);
    }
    for (const a of taskAssignees || []) {
      const newTaskId = taskOldToNew.get(a.taskId);
      const newPersonId = personOldToNew.get(a.personId);
      if (newTaskId != null && newPersonId != null)
        await prisma.taskAssignee.create({ data: { taskId: newTaskId, personId: newPersonId } });
    }
    for (const c of comments || []) {
      const newTaskId = taskOldToNew.get(c.taskId);
      if (newTaskId != null)
        await prisma.comment.create({ data: { content: c.content, authorName: c.authorName, taskId: newTaskId } });
    }

    res.json({ ok: true, people: people.length, directions: (directions || []).length, tasks: (tasks || []).length });
  } catch (e) {
    res.status(500).json({ error: 'Import failed' });
  }
});

// --- Tasks ---

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// --- People ---

router.get('/people', async (_req: Request, res: Response) => {
  try {
    const people = await prisma.person.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(people);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

router.post('/people', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const person = await prisma.person.create({ data: { name, email: email || null } });
    res.status(201).json(person);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create person' });
  }
});

router.put('/people/:id', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    const person = await prisma.person.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(email !== undefined && { email: email === '' || email == null ? null : String(email).trim() }),
      },
    });
    res.json(person);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update person' });
  }
});

router.delete('/people/:id', async (req: Request, res: Response) => {
  try {
    await prisma.person.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// --- Directions ---

router.get('/directions', async (_req: Request, res: Response) => {
  try {
    const dirs = await prisma.direction.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(dirs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch directions' });
  }
});

router.put('/directions/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const dir = await prisma.direction.update({
      where: { id: Number(req.params.id) },
      data: { name: String(name).trim() },
    });
    res.json(dir);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update direction' });
  }
});

router.delete('/directions/:id', async (req: Request, res: Response) => {
  try {
    await prisma.direction.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete direction' });
  }
});

export { router as adminRouter };
