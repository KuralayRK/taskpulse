import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, mvp: true });
});

/** GET /board — месяцы с эпиками + направления + продукты */
router.get('/board', async (_req, res) => {
  try {
    const [months, directions, products] = await Promise.all([
      prisma.mvpMonth.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              product: { include: { direction: true } },
              _count: { select: { tasks: true } },
              tasks: {
                select: { id: true, status: true },
              },
            },
          },
        },
      }),
      prisma.direction.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
      prisma.product.findMany({ orderBy: { name: 'asc' }, include: { direction: true, _count: { select: { mvpItems: true } } } }),
    ]);
    res.json({ months, directions, products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load MVP board' });
  }
});

/** PUT /items/order — после drag-and-drop */
router.put('/items/order', async (req, res) => {
  try {
    const updates = req.body?.updates as { id: number; monthId: number; sortOrder: number }[] | undefined;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates[] required' });
    }
    await prisma.$transaction(
      updates.map((u) =>
        prisma.mvpItem.update({
          where: { id: u.id },
          data: { monthId: u.monthId, sortOrder: u.sortOrder },
        })
      )
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

/** POST /items — новый эпик */
router.post('/items', async (req, res) => {
  try {
    const { title, monthId, endMonthId, productId } = req.body as {
      title?: string;
      monthId?: number;
      endMonthId?: number | null;
      productId?: number | null;
    };
    if (!title?.trim() || monthId == null) {
      return res.status(400).json({ error: 'title and monthId required' });
    }
    const maxOrder = await prisma.mvpItem.aggregate({
      where: { monthId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const item = await prisma.mvpItem.create({
      data: {
        title: title.trim(),
        monthId,
        endMonthId: endMonthId ?? null,
        sortOrder,
        productId: productId ?? null,
      },
      include: { product: { include: { direction: true } }, _count: { select: { tasks: true } }, tasks: { select: { id: true, status: true } } },
    });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

/** PUT /items/:id — обновить эпик */
router.put('/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const data: Record<string, unknown> = {};
    const { title, monthId, endMonthId, productId } = req.body;
    if (title !== undefined) {
      if (!title?.trim()) return res.status(400).json({ error: 'title required' });
      data.title = title.trim();
    }
    if (monthId !== undefined) data.monthId = Number(monthId);
    if (endMonthId !== undefined) data.endMonthId = endMonthId ? Number(endMonthId) : null;
    if (productId !== undefined) data.productId = productId ? Number(productId) : null;

    const item = await prisma.mvpItem.update({
      where: { id },
      data,
      include: { product: { include: { direction: true } }, _count: { select: { tasks: true } }, tasks: { select: { id: true, status: true } } },
    });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/** DELETE /items/:id */
router.delete('/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await prisma.mvpItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

/** GET /items/:id — полный эпик с задачами */
router.get('/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.mvpItem.findUnique({
      where: { id },
      include: {
        month: true,
        endMonth: true,
        product: { include: { direction: true } },
        tasks: {
          include: {
            assignees: { include: { person: true } },
            direction: true,
          },
          orderBy: { deadline: { sort: 'asc', nulls: 'last' } },
        },
      },
    });
    if (!item) return res.status(404).json({ error: 'Epic not found' });
    res.json({
      ...item,
      tasks: item.tasks.map((t) => ({
        ...t,
        assignees: t.assignees.map((a) => a.person),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load epic' });
  }
});

/** POST /items/:id/link-task — привязать задачу к эпику */
router.post('/items/:id/link-task', async (req, res) => {
  try {
    const epicId = Number(req.params.id);
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    await prisma.task.update({
      where: { id: Number(taskId) },
      data: { mvpItemId: epicId },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to link task' });
  }
});

/** POST /items/:id/unlink-task — отвязать задачу от эпика */
router.post('/items/:id/unlink-task', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    await prisma.task.update({
      where: { id: Number(taskId) },
      data: { mvpItemId: null },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to unlink task' });
  }
});

/** GET /products — все продукты */
router.get('/products', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { direction: true, _count: { select: { mvpItems: true, tasks: true } } },
    });
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/** POST /products — создать продукт */
router.post('/products', async (req, res) => {
  try {
    const { name, directionId } = req.body;
    if (!name?.trim() || !directionId) return res.status(400).json({ error: 'name and directionId required' });
    const product = await prisma.product.create({
      data: { name: name.trim(), directionId: Number(directionId) },
      include: { direction: true },
    });
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/** PUT /products/:id — обновить продукт */
router.put('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data: Record<string, unknown> = {};
    const { name, directionId } = req.body;
    if (name !== undefined) data.name = name.trim();
    if (directionId !== undefined) data.directionId = Number(directionId);
    const product = await prisma.product.update({
      where: { id },
      data,
      include: { direction: true },
    });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/** DELETE /products/:id */
router.delete('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export { router as mvpRouter };
