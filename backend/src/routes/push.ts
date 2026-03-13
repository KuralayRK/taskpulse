import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.get('/vapid-key', (_req: Request, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/push/subscribe', async (req: Request, res: Response) => {
  try {
    const { subscription, userName } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userName: userName || null,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userName: userName || null,
      },
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.post('/push/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

export { router as pushRouter };
