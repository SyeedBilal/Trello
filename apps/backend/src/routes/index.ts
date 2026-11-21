import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { boardRouter } from '../modules/boards/board.routes.js';
import { listRouter } from '../modules/lists/list.routes.js';
import { cardRouter } from '../modules/cards/card.routes.js';

export const apiRouter = Router();
apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Backend is healthy', data: { status: 'ok' } });
});
apiRouter.use('/auth', authRouter);
apiRouter.use('/boards', boardRouter);
apiRouter.use('/lists', listRouter);
apiRouter.use('/cards', cardRouter);
