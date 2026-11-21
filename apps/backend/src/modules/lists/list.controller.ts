import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { requiredParam } from '../../utils/request.js';
import * as listService from './list.service.js';

export async function createList(req: AuthenticatedRequest, res: Response) {
  const list = await listService.createList(requiredParam(req, 'boardId'), req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'List created', data: { list } });
}

export async function getLists(req: AuthenticatedRequest, res: Response) {
  const lists = await listService.getLists(requiredParam(req, 'boardId'), req.user!.id);
  res.json({ success: true, message: 'Lists retrieved', data: { lists } });
}

export async function updateList(req: AuthenticatedRequest, res: Response) {
  const list = await listService.updateList(requiredParam(req, 'listId'), req.user!.id, req.body);
  res.json({ success: true, message: 'List updated', data: { list } });
}

export async function deleteList(req: AuthenticatedRequest, res: Response) {
  await listService.deleteList(requiredParam(req, 'listId'), req.user!.id);
  res.json({ success: true, message: 'List deleted', data: null });
}
