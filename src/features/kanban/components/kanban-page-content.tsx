'use client';

import { GoogleTasksKanbanBoard } from './google-tasks-kanban-board';

export function KanbanPageContent() {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <GoogleTasksKanbanBoard />
    </div>
  );
}
