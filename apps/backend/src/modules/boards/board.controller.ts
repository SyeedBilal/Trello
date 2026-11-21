import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { requiredParam } from '../../utils/request.js';
import * as boardService from './board.service.js';
import { generateBoardSummary as generateAiBoardSummary } from '../ai/ai.service.js';
export async function generateBoardSummary(req: AuthenticatedRequest, res: Response) {
  const summary = await generateAiBoardSummary(requiredParam(req, 'boardId'), req.user!.id);
  res.json({ success: true, message: 'AI summary generated', data: summary });
}

export async function createBoard(req: AuthenticatedRequest, res: Response) {
  const board = await boardService.createBoard(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Board created', data: { board } });
}

export async function getBoards(req: AuthenticatedRequest, res: Response) {
  const boards = await boardService.getBoards(req.user!.id);
  res.json({ success: true, message: 'Boards retrieved', data: { boards } });
}

export async function getBoard(req: AuthenticatedRequest, res: Response) {
  const board = await boardService.getBoard(requiredParam(req, 'boardId'), req.user!.id);
  res.json({ success: true, message: 'Board retrieved', data: { board } });
}

export async function updateBoard(req: AuthenticatedRequest, res: Response) {
  const board = await boardService.updateBoard(requiredParam(req, 'boardId'), req.user!.id, req.body);
  res.json({ success: true, message: 'Board updated', data: { board } });
}

export async function deleteBoard(req: AuthenticatedRequest, res: Response) {
  await boardService.deleteBoard(requiredParam(req, 'boardId'), req.user!.id);
  res.json({ success: true, message: 'Board deleted', data: null });
}

export async function reorderCards(req: AuthenticatedRequest, res: Response) {
  const result = await boardService.reorderCards(requiredParam(req, 'boardId'), req.user!.id, req.body.items);
  res.json({ success: true, message: 'Cards reordered', data: result });
}

export async function reorderLists(req: AuthenticatedRequest, res: Response) {
  const result = await boardService.reorderLists(requiredParam(req, 'boardId'), req.user!.id, req.body.items);
  res.json({ success: true, message: 'Lists reordered', data: result });
}
