import { apiRequest } from './api';
import type { Card } from './boardService';

export interface CardInput {
  title: string;
  description?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  labels: string[];
}

export const cardService = {
  getForList: (listId: string, token: string) => apiRequest<{ data: { cards: Card[] } }>(`/lists/${listId}/cards`, {}, token),
  create: (listId: string, input: CardInput, token: string) => apiRequest<{ data: { card: Card } }>(`/lists/${listId}/cards`, { method: 'POST', body: JSON.stringify(input) }, token),
  getById: (cardId: string, token: string) => apiRequest<{ data: { card: Card } }>(`/cards/${cardId}`, {}, token),
  update: (cardId: string, input: Partial<CardInput>, token: string) => apiRequest<{ data: { card: Card } }>(`/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(input) }, token),
  remove: (cardId: string, token: string) => apiRequest<{ data: null }>(`/cards/${cardId}`, { method: 'DELETE' }, token),
};
