import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticateUser } from '../../middleware/authenticate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { loginController, logoutController, meController, refreshController, registerController } from './auth.controller.js';

export const authRouter = Router();
authRouter.post('/register', validate(registerSchema), registerController);
authRouter.post('/login', validate(loginSchema), loginController);
authRouter.post('/refresh', refreshController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', authenticateUser, meController);
