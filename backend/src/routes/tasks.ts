import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignee: true,
        _count: { select: { comments: true } },
      },
      orderBy: { deadline: 'asc' },
    });
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        assignee: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/tasks/:id/comments', async (req, res) => {
  try {
    const { content, authorName } = req.body;
    if (!content || !authorName) {
      return res.status(400).json({ error: 'content and authorName are required' });
    }
    const task = await prisma.task.findUnique({ where: { id: Number(req.params.id) } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = await prisma.comment.create({
      data: {
        content,
        authorName,
        taskId: Number(req.params.id),
      },
    });
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export { router as tasksRouter };
