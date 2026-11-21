import { apiRequest } from './api';

export interface Board {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  labels: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardList {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cards?: Card[];
}

export interface BoardDetail extends Board { lists: BoardList[] }

export interface BoardSummary {
  overview: string;
  progress: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionPercentage: number;
  };
  highPriorityTasks: Array<{ title: string; dueDate: string | null }>;
  overdueTasks: Array<{ title: string; dueDate: string }>;
  bottlenecks: Array<{ issue: string; evidence: string }>;
  recommendedActions: string[];
}

export const boardService = {
  getAll: (token: string) => apiRequest<{ data: { boards: Board[] } }>('/boards', {}, token),
  getById: (id: string, token: string) => apiRequest<{ data: { board: BoardDetail } }>(`/boards/${id}`, {}, token),
  create: (title: string, description: string | null, token: string) => apiRequest<{ data: { board: Board } }>('/boards', { method: 'POST', body: JSON.stringify({ title, description }) }, token),
  update: (id: string, input: { title?: string; description?: string | null }, token: string) => apiRequest<{ data: { board: Board } }>(`/boards/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, token),
  remove: (id: string, token: string) => apiRequest<{ data: null }>(`/boards/${id}`, { method: 'DELETE' }, token),
  getLists: (id: string, token: string) => apiRequest<{ data: { lists: BoardList[] } }>(`/boards/${id}/lists`, {}, token),
  createList: (boardId: string, title: string, token: string) => apiRequest<{ data: { list: BoardList } }>(`/boards/${boardId}/lists`, { method: 'POST', body: JSON.stringify({ title }) }, token),
  updateList: (listId: string, title: string, token: string) => apiRequest<{ data: { list: BoardList } }>(`/lists/${listId}`, { method: 'PATCH', body: JSON.stringify({ title }) }, token),
  removeList: (listId: string, token: string) => apiRequest<{ data: null }>(`/lists/${listId}`, { method: 'DELETE' }, token),
  reorderCards: (boardId: string, items: Array<{ cardId: string; listId: string; position: number }>, token: string) => apiRequest<{ data: { updatedCards: number } }>(`/boards/${boardId}/cards/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }, token),
  reorderLists: (boardId: string, items: Array<{ listId: string; position: number }>, token: string) => apiRequest<{ data: { updatedLists: number } }>(`/boards/${boardId}/lists/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }, token),
  generateSummary: (boardId: string, token: string) => apiRequest<{ data: BoardSummary }>(`/boards/${boardId}/ai-summary`, { method: 'POST' }, token),
};
