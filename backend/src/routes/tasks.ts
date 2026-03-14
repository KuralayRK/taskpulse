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
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, authorName: true, createdAt: true },
        },
      },
      orderBy: { deadline: 'asc' },
    });
    const shaped = tasks.map((t) => ({
      ...t,
      lastComment: t.comments[0] || null,
      comments: undefined,
    }));
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/people', async (_req, res) => {
  try {
    const people = await prisma.person.findMany({ orderBy: { name: 'asc' } });
    res.json(people);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch people' });
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

router.post('/tasks', async (req, res) => {
  try {
    const { title, description, deadline, priority, assigneeId } = req.body;
    if (!title || !deadline) {
      return res.status(400).json({ error: 'title and deadline are required' });
    }
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        deadline: new Date(deadline),
        priority: priority || 'medium',
        assigneeId: assigneeId ? Number(assigneeId) : null,
      },
      include: { assignee: true },
    });
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: Number(req.params.id) } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const data: Record<string, unknown> = {};
    const { title, description, deadline, status, priority } = req.body;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (deadline !== undefined) data.deadline = new Date(deadline);
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;

    const updated = await prisma.task.update({
      where: { id: Number(req.params.id) },
      data,
      include: { assignee: true, comments: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update task' });
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
