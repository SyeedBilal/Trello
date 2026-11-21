import { Router } from 'express';
import { authenticateUser } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { deleteCard, getCard, updateCard } from './card.controller.js';
import { updateCardSchema } from './card.schemas.js';

export const cardRouter = Router();
cardRouter.use(authenticateUser);
cardRouter.get('/:cardId', getCard);
cardRouter.patch('/:cardId', validate(updateCardSchema), updateCard);
cardRouter.delete('/:cardId', deleteCard);
