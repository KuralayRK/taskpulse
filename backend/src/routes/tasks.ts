import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const taskInclude = {
  assignees: { include: { person: true } },
  direction: true,
  _count: { select: { comments: true } },
  comments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { content: true, authorName: true, createdAt: true },
  },
};

function shapeTask(t: any) {
  return {
    ...t,
    assignees: t.assignees?.map((a: any) => a.person) || [],
    lastComment: t.comments?.[0] || null,
    comments: undefined,
  };
}

router.get('/tasks', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim().toLowerCase();
    const where = q ? {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { comments: { some: { content: { contains: q } } } },
      ],
    } : undefined;
    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { deadline: { sort: 'asc', nulls: 'last' } },
    });
    res.json(tasks.map(shapeTask));
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

router.get('/directions', async (_req, res) => {
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

router.post('/directions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const dir = await prisma.direction.upsert({
      where: { name: name.trim() },
      update: {},
      create: { name: name.trim() },
    });
    res.status(201).json(dir);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create direction' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        assignees: { include: { person: true } },
        direction: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({
      ...task,
      assignees: task.assignees.map((a) => a.person),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { title, description, startDate, deadline, priority, assigneeIds, directionId, directionName } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!priority) return res.status(400).json({ error: 'priority is required' });
    if (!assigneeIds || !assigneeIds.length) return res.status(400).json({ error: 'at least one assignee is required' });
    if (assigneeIds.length > 4) return res.status(400).json({ error: 'max 4 assignees' });

    let resolvedDirId = directionId ? Number(directionId) : null;
    if (!resolvedDirId && directionName?.trim()) {
      const dir = await prisma.direction.upsert({
        where: { name: directionName.trim() },
        update: {},
        create: { name: directionName.trim() },
      });
      resolvedDirId = dir.id;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        priority,
        directionId: resolvedDirId,
        assignees: {
          create: assigneeIds.map((id: number) => ({ personId: Number(id) })),
        },
      },
      include: {
        assignees: { include: { person: true } },
        direction: true,
      },
    });
    res.status(201).json({ ...task, assignees: task.assignees.map((a) => a.person) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: Number(req.params.id) } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const data: Record<string, unknown> = {};
    const { title, description, startDate, deadline, status, priority, assigneeIds, directionId, directionName } = req.body;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;

    if (directionId !== undefined) {
      data.directionId = directionId ? Number(directionId) : null;
    } else if (directionName !== undefined) {
      if (directionName?.trim()) {
        const dir = await prisma.direction.upsert({
          where: { name: directionName.trim() },
          update: {},
          create: { name: directionName.trim() },
        });
        data.directionId = dir.id;
      } else {
        data.directionId = null;
      }
    }

    if (assigneeIds !== undefined) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: Number(req.params.id) } });
      if (assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: assigneeIds.slice(0, 4).map((id: number) => ({ taskId: Number(req.params.id), personId: Number(id) })),
        });
      }
    }

    const updated = await prisma.task.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        assignees: { include: { person: true } },
        direction: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    res.json({ ...updated, assignees: updated.assignees.map((a) => a.person) });
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
      data: { content, authorName, taskId: Number(req.params.id) },
    });
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export { router as tasksRouter };
