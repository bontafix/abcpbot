import express from 'express';
import { appendLogLine } from '../utils/fileLogger';
import { OrderRepository } from '../repositories/orderRepository';
import { getDistributors } from '../abcp';

// Допустимые статусы (только англ коды)
const ALLOWED_STATUS: Array<'new' | 'in_progress' | 'rejected' | 'completed' | 'reserved'> = [
  'new', 'in_progress', 'rejected', 'completed', 'reserved'
];
function normalizeStatus(input: string): 'new' | 'in_progress' | 'rejected' | 'completed' | 'reserved' | null {
  const key = String(input || '').trim().toLowerCase();
  return (ALLOWED_STATUS as readonly string[]).includes(key) ? (key as any) : null;
}

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const requiredKey = process.env.API_KEY;
  if (!requiredKey) { next(); return; }
  const provided = req.header('x-api-key') || '';
  if (provided !== requiredKey) { res.status(401).json({ error: 'unauthorized' }); return; }
  next();
}

export function registerBotApiRoutes(app: express.Application): void {
  // Логирование запросов к /bot-api в файл logs/api.log
  app.use('/bot-api', async (req, res, next) => {
    const startedAt = Date.now();
    const { method, url } = req;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const requestId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;

    // Простейшая безопасная выборка тела (не больше 5кб)
    const bodyPreview = (() => {
      try {
        const raw = JSON.stringify(req.body || {});
        return raw.length > 5000 ? raw.slice(0, 5000) + '…' : raw;
      } catch {
        return '[unserializable]';
      }
    })();

    res.on('finish', async () => {
      const durationMs = Date.now() - startedAt;
      const status = res.statusCode;
      const line = JSON.stringify({
        ts: new Date(startedAt).toISOString(),
        requestId,
        ip,
        method,
        url,
        status,
        durationMs,
        userAgent,
        bodyPreview,
      });
      await appendLogLine('logs/api.log', line);
    });

    next();
  });
  // GET /bot-api/orders?telegramId=&since=ISO&page=1&pageSize=100
  app.get('/bot-api/orders', requireApiKey, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const telegramId = (req.query.telegramId as string) || '';
      const sinceStr = (req.query.since as string) || '';
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize || 100)));
      const sinceDate = sinceStr ? new Date(sinceStr) : undefined;
      const since = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined;

      const rows = await OrderRepository.list({
        telegramId: telegramId || undefined,
        since,
        page,
        pageSize,
      });

      // Получим дистрибьюторов и преобразуем в map по id
      let distributorsMap: Record<string, any> = {};
      try {
        const distributors: any[] = await getDistributors();
        distributorsMap = Array.isArray(distributors)
          ? distributors.reduce((acc: Record<string, any>, d: any) => {
              const id = String(d?.id ?? d?.distributorId ?? '');
              if (id) {
                acc[id] = {
                  id,
                  name: d?.name,
                  contractor: d?.contractor,
                  updateTime: d?.updateTime,
                };
              }
              return acc;
            }, {})
          : {};
      } catch (e) {
        distributorsMap = {};
      }

      res.json({ page, pageSize, count: rows.length, orders: rows, distributorsMap });
      return;
    } catch (e: any) {
      console.error('GET /api/orders error:', e?.message || e);
      res.status(500).json({ error: 'internal_error' });
      return;
    }
  });

  // POST /bot-api/orders/status { telegramId: string, orderId: number, status: string }
  app.post('/bot-api/orders/status', requireApiKey, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const telegramId = String(req.body?.telegramId || '').trim();
      const orderIdNum = Number(req.body?.orderId);
      const statusInput = String(req.body?.status || '').trim();

      if (!telegramId) {
        res.status(400).json({ error: 'telegramId_required' });
        return;
      }
      if (!Number.isFinite(orderIdNum) || orderIdNum <= 0) {
        res.status(400).json({ error: 'orderId_invalid' });
        return;
      }
      if (!statusInput) {
        res.status(400).json({ error: 'status_required' });
        return;
      }

      const normalizedStatus = normalizeStatus(statusInput);
      if (!normalizedStatus) {
        res.status(400).json({ error: 'status_invalid', allowed: ['new','in_progress','rejected','completed','reserved'] });
        return;
      }

      const result = await OrderRepository.updateStatusByTelegram(orderIdNum, telegramId, normalizedStatus);
      if (!result?.success) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
      return;
    } catch (e: any) {
      console.error('POST /api/orders/status error:', e?.message || e);
      res.status(500).json({ error: 'internal_error' });
      return;
    }
  });

  // POST /bot-api/admin/orders/status { orderId: number, status: string }
  app.post('/bot-api/admin/orders/status', requireApiKey, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const orderIdNum = Number(req.body?.orderId);
      const statusInput = String(req.body?.status || '').trim();

      if (!Number.isFinite(orderIdNum) || orderIdNum <= 0) {
        res.status(400).json({ error: 'orderId_invalid' });
        return;
      }
      if (!statusInput) {
        res.status(400).json({ error: 'status_required' });
        return;
      }

      const normalizedStatus = normalizeStatus(statusInput);
      if (!normalizedStatus) {
        res.status(400).json({ error: 'status_invalid', allowed: ['new','in_progress','rejected','completed','reserved'] });
        return;
      }

      const result = await OrderRepository.updateStatus(orderIdNum, normalizedStatus);
      if (!result?.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
      return;
    } catch (e: any) {
      console.error('POST /api/admin/orders/status error:', e?.message || e);
      res.status(500).json({ error: 'internal_error' });
      return;
    }
  });
}


