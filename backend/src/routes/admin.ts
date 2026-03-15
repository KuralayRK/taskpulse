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
