import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { requiredParam } from '../../utils/request.js';
import * as cardService from './card.service.js';

export async function createCard(req: AuthenticatedRequest, res: Response) {
  const card = await cardService.createCard(requiredParam(req, 'listId'), req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Card created', data: { card } });
}

export async function getCards(req: AuthenticatedRequest, res: Response) {
  const cards = await cardService.getCards(requiredParam(req, 'listId'), req.user!.id);
  res.json({ success: true, message: 'Cards retrieved', data: { cards } });
}

export async function getCard(req: AuthenticatedRequest, res: Response) {
  const card = await cardService.getCard(requiredParam(req, 'cardId'), req.user!.id);
  res.json({ success: true, message: 'Card retrieved', data: { card } });
}

export async function updateCard(req: AuthenticatedRequest, res: Response) {
  const card = await cardService.updateCard(requiredParam(req, 'cardId'), req.user!.id, req.body);
  res.json({ success: true, message: 'Card updated', data: { card } });
}

export async function deleteCard(req: AuthenticatedRequest, res: Response) {
  await cardService.deleteCard(requiredParam(req, 'cardId'), req.user!.id);
  res.json({ success: true, message: 'Card deleted', data: null });
}
