# Phase 3 — Drag-and-Drop Persistence

## Dependencies

The frontend uses:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

## API endpoints

```http
PATCH /api/boards/:boardId/cards/reorder
PATCH /api/boards/:boardId/lists/reorder
```

### Card reorder payload

```json
{
  "items": [
    { "cardId": "card-1", "listId": "list-1", "position": 0 },
    { "cardId": "card-2", "listId": "list-2", "position": 0 }
  ]
}
```

Zod requires UUID card/list identifiers and sequential positions within each list.

### List reorder payload

```json
{
  "items": [
    { "listId": "list-1", "position": 0 },
    { "listId": "list-2", "position": 1 }
  ]
}
```

## Frontend behavior

`BoardDragPage` is the board drag-and-drop context. It uses:

- `DndContext` for drag events.
- `SortableContext` for horizontal lists and vertical cards.
- `useSortable` for list/card transforms.
- `DragOverlay` for active card/list previews.
- Pointer and keyboard sensors.
- `closestCorners` collision detection.

Each card has a dedicated drag handle, so clicking the card body opens details without starting a drag.

## Optimistic updates

Before dragging, the board is copied as a rollback snapshot.

The UI state is changed during drag-over/drag-end:

- Cards move within or between lists immediately.
- List arrays are reordered immediately.
- The backend receives the complete affected ordering.
- A failure restores the snapshot and displays an error message.

## Backend transactions

Reorder services first verify:

- The authenticated user owns the board.
- Every destination list belongs to the board.
- Every card belongs to a list in the board.

Card updates and list updates use Prisma transactions. Reorder operations stage records at temporary negative positions to avoid temporary unique-position conflicts, then write the final sequential positions.

For moved cards, source and destination lists are normalized from their complete current card sets.

## Example: Implement Login API

A card is dragged from To Do to In Progress:

1. dnd-kit detects the card and destination list.
2. `handleDragOver` moves it from source state to destination state immediately.
3. `handleDragEnd` constructs a complete card-position array.
4. The frontend calls `PATCH /api/boards/:boardId/cards/reorder`.
5. Express authenticates the request and validates Zod payload.
6. The board owner check prevents access to another user's board.
7. Prisma verifies cards/lists belong to the board.
8. A transaction updates list associations and normalizes positions.
9. Refreshing the board loads the persisted ordering from PostgreSQL.

## Verification

Live tests cover:

- Card reordering within a list.
- Moving cards between lists.
- Source/destination position normalization.
- Unauthorized card reorder attempts.
- Rejection of cards/lists outside the specified board.
- List reordering.
- Unauthorized list reorder attempts.

Current result: **22 tests pass across 5 test files**.

## Known limitations

- Rapid simultaneous drag persistence can be improved with request sequencing.
- Card and list drag operations do not debounce or cancel stale in-flight requests.
- Mobile touch behavior depends on browser/touch compatibility.
- Dragging is optimistic, but API failures restore the full drag-start snapshot.
