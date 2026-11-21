import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CardModal } from '../components/CardModal';
import { useAuth } from '../context/AuthContext';
import { boardService, type BoardDetail, type BoardList, type BoardSummary, type Card } from '../services/boardService';
import { cardService } from '../services/cardService';

interface ActiveDrag {
  type: 'card' | 'list';
  card?: Card;
  list?: BoardList;
}

function SortableCard({ card, list, onOpen }: { card: Card; list: BoardList; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, listId: list.id },
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? 'opacity-30' : ''}`}>
      <div className="flex items-start gap-2">
        <button type="button" {...attributes} {...listeners} aria-label={`Drag ${card.title}`} className="mt-0.5 cursor-grab touch-none rounded px-1 text-slate-400 active:cursor-grabbing">⠿</button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
          {card.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.priority === 'HIGH' ? 'bg-red-100 text-red-700' : card.priority === 'LOW' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{card.priority}</span>
            {card.labels.map((label) => <span key={label} className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">{label}</span>)}
            {card.dueDate && <time dateTime={card.dueDate} className="text-[10px] font-medium text-slate-500">Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(card.dueDate))}</time>}
          </div>
        </button>
      </div>
    </div>
  );
}

function CardPreview({ card }: { card: Card }) {
  return <div className="w-72 rotate-2 rounded-lg border border-indigo-200 bg-white p-3 shadow-xl"><h3 className="text-sm font-semibold text-slate-900">{card.title}</h3></div>;
}

function SortableList({ list, onRename, onDelete, onOpenCard, onAddCard }: { list: BoardList; onRename: () => void; onDelete: () => void; onOpenCard: (card: Card) => void; onAddCard: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: 'list', list },
  });

  return (
    <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 ${isDragging ? 'opacity-30' : ''}`}>
      <div className="flex items-center justify-between px-1">
        <button type="button" {...attributes} {...listeners} aria-label={`Drag list ${list.title}`} className="cursor-grab touch-none rounded text-slate-400 active:cursor-grabbing">⠿</button>
        <h2 className="font-bold text-slate-800">{list.title}</h2>
        <div className="flex gap-2"><button onClick={onRename} className="text-xs text-slate-500">Edit</button><button onClick={onDelete} className="text-xs text-red-500">Delete</button></div>
      </div>
      <SortableContext items={(list.cards ?? []).map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-3 min-h-8 space-y-2">
          {(list.cards ?? []).map((card) => <SortableCard key={card.id} card={card} list={list} onOpen={() => onOpenCard(card)} />)}
        </div>
      </SortableContext>
      <button type="button" onClick={onAddCard} className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-500 hover:bg-slate-200">+ Add card</button>
    </section>
  );
}

export function BoardDragPage() {
  const { boardId } = useParams();
  const { accessToken, logout } = useAuth();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [editingList, setEditingList] = useState<BoardList | null>(null);
  const [listTitle, setListTitle] = useState('');
  const [modalCard, setModalCard] = useState<Card | null>(null);
  const [modalList, setModalList] = useState<BoardList | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const boardBeforeDrag = useRef<BoardDetail | null>(null);
  const [summary, setSummary] = useState<BoardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function loadBoard() {
    if (!accessToken || !boardId) return;
    setLoading(true);
    try { const result = await boardService.getById(boardId, accessToken); setBoard(result.data.board); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load board'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadBoard(); }, [accessToken, boardId]);

  async function addList(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !boardId || !newListTitle.trim()) return;
    try {
      const result = await boardService.createList(boardId, newListTitle.trim(), accessToken);
      setBoard((current) => current ? { ...current, lists: [...current.lists, { ...result.data.list, cards: [] }] } : current);
      setNewListTitle('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create list'); }
  }

  function openRename(list: BoardList) { setEditingList(list); setListTitle(list.title); }

  async function renameList(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !editingList || !listTitle.trim()) return;
    try {
      const result = await boardService.updateList(editingList.id, listTitle.trim(), accessToken);
      setBoard((current) => current ? { ...current, lists: current.lists.map((list) => list.id === editingList.id ? { ...list, title: result.data.list.title } : list) } : current);
      setEditingList(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to rename list'); }
  }

  async function removeList(list: BoardList) {
    if (!accessToken || !window.confirm(`Delete "${list.title}" and its cards?`)) return;
    try { await boardService.removeList(list.id, accessToken); setBoard((current) => current ? { ...current, lists: current.lists.filter((item) => item.id !== list.id) } : current); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to delete list'); }
  }

  async function saveCard(input: { title: string; description: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate: string | null; labels: string[] }) {
    if (!accessToken || !modalList) return;
    if (modalCard) {
      const result = await cardService.update(modalCard.id, input, accessToken);
      setBoard((current) => current ? { ...current, lists: current.lists.map((list) => list.id === modalList.id ? { ...list, cards: (list.cards ?? []).map((card) => card.id === modalCard.id ? result.data.card : card) } : list) } : current);
    } else {
      const result = await cardService.create(modalList.id, input, accessToken);
      setBoard((current) => current ? { ...current, lists: current.lists.map((list) => list.id === modalList.id ? { ...list, cards: [...(list.cards ?? []), result.data.card] } : list) } : current);
    }
  }

  async function deleteModalCard() {
    if (!accessToken || !modalCard) return;
    if (!window.confirm('Delete this card?')) return;
    await cardService.remove(modalCard.id, accessToken);
    setBoard((current) => current ? { ...current, lists: current.lists.map((list) => ({ ...list, cards: (list.cards ?? []).filter((card) => card.id !== modalCard.id) })) } : current);
    setModalCard(null);
    setModalList(null);
  }

  function findListForCard(current: BoardDetail, cardId: string) {
    return current.lists.find((list) => (list.cards ?? []).some((card) => card.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    if (!board) return;
    boardBeforeDrag.current = structuredClone(board);
    const type = event.active.data.current?.type;
    if (type === 'card') {
      const card = event.active.data.current?.card as Card;
      setActiveDrag({ type: 'card', card });
    } else if (type === 'list') {
      const list = event.active.data.current?.list as BoardList;
      setActiveDrag({ type: 'list', list });
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (!board || event.active.data.current?.type !== 'card' || !event.over) return;
    const over = event.over;
    const cardId = String(event.active.id);
    const overType = over.data.current?.type;

    setBoard((current) => {
      if (!current) return current;
      const sourceList = findListForCard(current, cardId);
      if (!sourceList) return current;

      let destinationListId = '';
      if (overType === 'card') destinationListId = String(over.data.current?.listId);
      else if (overType === 'list') destinationListId = String(over.id);
      if (!destinationListId) return current;

      const destinationList = current.lists.find((list) => list.id === destinationListId);
      if (!destinationList || sourceList.id === destinationListId) return current;

      const card = (sourceList.cards ?? []).find((item) => item.id === cardId);
      if (!card) return current;

      const lists = current.lists.map((list) => {
        if (list.id === sourceList.id) return { ...list, cards: (list.cards ?? []).filter((item) => item.id !== cardId) };
        return list;
      });

      const targetListIndex = lists.findIndex((list) => list.id === destinationListId);
      const destinationCards = [...(lists[targetListIndex]!.cards ?? [])];
      let insertIndex = destinationCards.length;
      if (overType === 'card') {
        const overIndex = destinationCards.findIndex((item) => item.id === String(over.id));
        if (overIndex >= 0) insertIndex = overIndex;
      }
      destinationCards.splice(insertIndex, 0, { ...card, listId: destinationListId });
      lists[targetListIndex] = { ...lists[targetListIndex]!, cards: destinationCards };

      return { ...current, lists };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const previous = boardBeforeDrag.current;
    boardBeforeDrag.current = null;

    if (!board || !boardId || !accessToken) {
      if (previous) setBoard(previous);
      return;
    }
    if (!event.over) {
      if (previous) setBoard(previous);
      return;
    }

    const activeType = event.active.data.current?.type;

    if (activeType === 'list') {
      const over = event.over;
      const fromIndex = board.lists.findIndex((list) => list.id === String(event.active.id));
      const toIndex = board.lists.findIndex((list) => list.id === String(over.id));
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

      const reordered = arrayMove(board.lists, fromIndex, toIndex).map((list, position) => ({ ...list, position }));
      setBoard((current) => current ? { ...current, lists: reordered } : current);

      try {
        await boardService.reorderLists(boardId, reordered.map((list) => ({ listId: list.id, position: list.position })), accessToken);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to save list order');
        if (previous) setBoard(previous);
      }
      return;
    }

    if (activeType === 'card') {
      const cardId = String(event.active.id);
      const overId = String(event.over.id);
      const overType = event.over.data.current?.type;
      let reordered = { ...board, lists: board.lists.map((list) => ({ ...list, cards: [...(list.cards ?? [])] })) };
      const sourceList = findListForCard(reordered, cardId);
      if (!sourceList) return;

      let destinationList = sourceList;
      if (overType === 'card') destinationList = findListForCard(reordered, overId) ?? sourceList;
      else if (overType === 'list') destinationList = reordered.lists.find((list) => list.id === overId) ?? sourceList;

      const sourceCards = [...(sourceList.cards ?? [])];
      const cardIndex = sourceCards.findIndex((card) => card.id === cardId);
      if (cardIndex < 0) return;

      if (sourceList.id === destinationList.id) {
        const toIndex = overType === 'card'
          ? sourceCards.findIndex((card) => card.id === overId)
          : sourceCards.length - 1;
        if (toIndex >= 0 && cardIndex !== toIndex) {
          const moved = arrayMove(sourceCards, cardIndex, toIndex);
          reordered = { ...reordered, lists: reordered.lists.map((list) => list.id === sourceList.id ? { ...list, cards: moved } : list) };
        }
      } else {
        const [card] = sourceCards.splice(cardIndex, 1);
        const destinationCards = [...(destinationList.cards ?? [])];
        const targetIndex = overType === 'card'
          ? destinationCards.findIndex((item) => item.id === overId)
          : destinationCards.length;
        destinationCards.splice(targetIndex < 0 ? destinationCards.length : targetIndex, 0, { ...card!, listId: destinationList.id });
        reordered = {
          ...reordered,
          lists: reordered.lists.map((list) => {
            if (list.id === sourceList.id) return { ...list, cards: sourceCards };
            if (list.id === destinationList.id) return { ...list, cards: destinationCards };
            return list;
          }),
        };
      }

      reordered = {
        ...reordered,
        lists: reordered.lists.map((list) => ({
          ...list,
          cards: (list.cards ?? []).map((card, position) => ({ ...card, listId: list.id, position })),
        })),
      };
      const items = reordered.lists.flatMap((list) => (list.cards ?? []).map((card) => ({
        cardId: card.id,
        listId: list.id,
        position: card.position,
      })));

      setBoard(reordered);
      try {
        await boardService.reorderCards(boardId, items, accessToken);
      }
      catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to save card order');
        if (previous) setBoard(previous);
      }
    }
  }

  function handleDragCancel() {
    if (boardBeforeDrag.current) setBoard(boardBeforeDrag.current);
    boardBeforeDrag.current = null;
    setActiveDrag(null);
  }

  async function handleLogout() { await logout(); }

  async function generateSummary() {
    if (!accessToken || !boardId || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await boardService.generateSummary(boardId, accessToken);
      setSummary(result.data);
    } catch (caught) {
      setSummaryError(caught instanceof Error ? caught.message : 'Unable to generate AI summary');
    } finally {
      setSummaryLoading(false);
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading board…</div>;

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white"><div className="flex items-center justify-between px-6 py-4"><div className="flex items-center gap-4"><Link to="/dashboard" className="text-sm font-semibold text-indigo-600">← Boards</Link><h1 className="text-lg font-bold text-slate-900">{board?.title ?? 'Board'}</h1></div><button onClick={() => void handleLogout()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Log out</button></div></header>
    {error && <div role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {board && <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="overflow-x-auto p-6"><p className="mb-5 text-sm text-slate-500">{board.description || 'No description'}</p>
        <div className="flex items-start gap-4">
          <SortableContext items={board.lists.map((list) => list.id)} strategy={horizontalListSortingStrategy}>
            {board.lists.map((list) => <SortableList key={list.id} list={list} onRename={() => openRename(list)} onDelete={() => void removeList(list)} onOpenCard={(card) => { setModalCard(card); setModalList(list); }} onAddCard={() => { setModalCard(null); setModalList(list); }} />)}
          </SortableContext>
          <form onSubmit={addList} className="w-72 shrink-0 rounded-xl border border-dashed border-slate-300 bg-white p-3"><input value={newListTitle} onChange={(event) => setNewListTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="New list title" /><button className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Add list</button></form>
        </div>
      </div>
      <DragOverlay>{activeDrag?.card ? <CardPreview card={activeDrag.card} /> : activeDrag?.list ? <div className="w-72 rounded-xl border border-indigo-200 bg-slate-50 p-4 shadow-xl"><h2 className="font-bold">{activeDrag.list.title}</h2></div> : null}</DragOverlay>
    </DndContext>}
    {board && <section className="mx-6 mb-8 max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">AI Board Summary</h2>
          <p className="mt-1 text-xs text-slate-500">Analysis based on the current board data</p>
        </div>
        <button type="button" onClick={() => void generateSummary()} disabled={summaryLoading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {summaryLoading ? 'Generating…' : summary ? 'Regenerate AI Summary' : 'Generate AI Summary'}
        </button>
      </div>

      {summaryError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p>{summaryError}</p>
        <button type="button" onClick={() => void generateSummary()} disabled={summaryLoading} className="mt-2 font-semibold underline">Retry</button>
      </div>}

      {summaryLoading && !summary && <p className="mt-5 text-sm text-slate-500">Generating the board summary…</p>}
      {!summaryLoading && !summary && !summaryError && <p className="mt-5 text-sm text-slate-500">Generate a summary to review progress, risks, and next actions.</p>}

      {summary && <div className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 p-4 md:col-span-2">
          <h3 className="text-sm font-bold text-slate-800">Project Overview</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.overview}</p>
        </article>
        <article className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800">Progress Overview</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
            <span>Total tasks</span><strong className="text-right text-slate-900">{summary.progress.totalTasks}</strong>
            <span>Completed</span><strong className="text-right text-emerald-700">{summary.progress.completed}</strong>
            <span>In progress</span><strong className="text-right text-amber-700">{summary.progress.inProgress}</strong>
            <span>Pending</span><strong className="text-right text-slate-900">{summary.progress.pending}</strong>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${summary.progress.completionPercentage}%` }} /></div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{summary.progress.completionPercentage}% complete</p>
        </article>
        <article className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800">High-Priority Tasks</h3>
          {summary.highPriorityTasks.length === 0 ? <p className="mt-3 text-sm text-slate-500">No unfinished high-priority tasks.</p> : <ul className="mt-3 space-y-2">{summary.highPriorityTasks.map((task) => <li key={task.title} className="rounded bg-red-50 px-3 py-2 text-sm text-red-800"><strong>{task.title}</strong>{task.dueDate && <span className="ml-2 text-xs">Due {task.dueDate}</span>}</li>)}</ul>}
        </article>
        <article className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800">Overdue Tasks</h3>
          {summary.overdueTasks.length === 0 ? <p className="mt-3 text-sm text-slate-500">No overdue tasks.</p> : <ul className="mt-3 space-y-2">{summary.overdueTasks.map((task) => <li key={task.title} className="rounded bg-orange-50 px-3 py-2 text-sm text-orange-800"><strong>{task.title}</strong><span className="ml-2 text-xs">Due {task.dueDate}</span></li>)}</ul>}
        </article>
        <article className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800">Potential Bottlenecks</h3>
          {summary.bottlenecks.length === 0 ? <p className="mt-3 text-sm text-slate-500">No supported bottlenecks identified.</p> : <ul className="mt-3 space-y-3">{summary.bottlenecks.map((item, index) => <li key={`${item.issue}-${index}`} className="text-sm text-slate-600"><strong className="text-slate-800">{item.issue}</strong><p className="mt-1 text-xs">{item.evidence}</p></li>)}</ul>}
        </article>
        <article className="rounded-lg border border-slate-200 p-4 md:col-span-2">
          <h3 className="text-sm font-bold text-slate-800">Recommended Next Actions</h3>
          {summary.recommendedActions.length === 0 ? <p className="mt-3 text-sm text-slate-500">No recommendations available.</p> : <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">{summary.recommendedActions.map((action, index) => <li key={`${action}-${index}`}>{action}</li>)}</ol>}
        </article>
      </div>}
    </section>}
    {editingList && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={renameList} className="w-full max-w-sm rounded-xl bg-white p-6"><h2 className="font-bold">Rename list</h2><input value={listTitle} onChange={(event) => setListTitle(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" /><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setEditingList(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Save</button></div></form></div>}
    {modalList && <CardModal card={modalCard} listTitle={modalList.title} onClose={() => { setModalCard(null); setModalList(null); }} onSave={saveCard} onDelete={modalCard ? deleteModalCard : undefined} />}
  </main>;
}
