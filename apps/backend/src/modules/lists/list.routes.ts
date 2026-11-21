import { Router } from 'express';
import { authenticateUser } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { deleteList, updateList } from './list.controller.js';
import { updateListSchema } from './list.schemas.js';
import { createCard, getCards } from '../cards/card.controller.js';
import { createCardSchema } from '../cards/card.schemas.js';

export const listRouter = Router();
listRouter.use(authenticateUser);
listRouter.patch('/:listId', validate(updateListSchema), updateList);
listRouter.delete('/:listId', deleteList);
listRouter.post('/:listId/cards', validate(createCardSchema), createCard);
listRouter.get('/:listId/cards', getCards);
