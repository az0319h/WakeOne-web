import 'server-only';

import { randomUUID } from 'node:crypto';
import type { GoogleTask, GoogleTaskList } from './types';

type MockUserStore = {
  tasklists: GoogleTaskList[];
  tasksByList: Map<string, GoogleTask[]>;
  seeded: boolean;
};

const stores = new Map<string, MockUserStore>();

function getStore(userId: string): MockUserStore {
  let store = stores.get(userId);
  if (!store) {
    store = { tasklists: [], tasksByList: new Map(), seeded: false };
    stores.set(userId, store);
  }
  return store;
}

function seedDefaultLists(store: MockUserStore) {
  if (store.seeded) {
    return;
  }
  store.seeded = true;
  if (store.tasklists.length > 0) {
    return;
  }
  const lists: GoogleTaskList[] = [
    { id: `tl-${randomUUID()}`, title: '업무', updated: new Date().toISOString(), isDefault: true },
    { id: `tl-${randomUUID()}`, title: '개인', updated: new Date().toISOString(), isDefault: false }
  ];
  store.tasklists = lists;
  for (const list of lists) {
    store.tasksByList.set(list.id, []);
  }
}

function sortTasks(tasks: GoogleTask[]): GoogleTask[] {
  return [...tasks].sort((a, b) => (a.position ?? '').localeCompare(b.position ?? ''));
}

function listTasks(store: MockUserStore, tasklistId: string): GoogleTask[] {
  return sortTasks(store.tasksByList.get(tasklistId) ?? []);
}

function touchList(store: MockUserStore, tasklistId: string) {
  const list = store.tasklists.find((item) => item.id === tasklistId);
  if (list) {
    list.updated = new Date().toISOString();
  }
}

export const googleTasksMockStore = {
  listTasklists(userId: string): GoogleTaskList[] {
    const store = getStore(userId);
    seedDefaultLists(store);
    return [...store.tasklists];
  },

  insertTasklist(userId: string, title: string): GoogleTaskList {
    const store = getStore(userId);
    seedDefaultLists(store);
    const tasklist: GoogleTaskList = {
      id: `tl-${randomUUID()}`,
      title,
      updated: new Date().toISOString(),
      isDefault: false
    };
    store.tasklists.push(tasklist);
    store.tasksByList.set(tasklist.id, []);
    return tasklist;
  },

  patchTasklist(userId: string, tasklistId: string, title: string): GoogleTaskList {
    const store = getStore(userId);
    const list = store.tasklists.find((item) => item.id === tasklistId);
    if (!list) {
      throw new Error('NOT_FOUND');
    }
    list.title = title;
    list.updated = new Date().toISOString();
    return list;
  },

  deleteTasklist(userId: string, tasklistId: string): void {
    const store = getStore(userId);
    const index = store.tasklists.findIndex((item) => item.id === tasklistId);
    if (index < 0) {
      throw new Error('NOT_FOUND');
    }
    if (store.tasklists[index]?.isDefault) {
      throw new Error('DEFAULT_LIST');
    }
    store.tasklists.splice(index, 1);
    store.tasksByList.delete(tasklistId);
  },

  listTasks(userId: string, tasklistId: string, showCompleted = true): GoogleTask[] {
    const store = getStore(userId);
    seedDefaultLists(store);
    if (!store.tasklists.some((item) => item.id === tasklistId)) {
      throw new Error('NOT_FOUND');
    }
    const tasks = listTasks(store, tasklistId);
    if (showCompleted) {
      return tasks;
    }
    return tasks.filter((task) => task.status !== 'completed');
  },

  insertTask(
    userId: string,
    tasklistId: string,
    input: { title: string; notes?: string; parent?: string; due?: string }
  ): GoogleTask {
    const store = getStore(userId);
    seedDefaultLists(store);
    if (!store.tasklists.some((item) => item.id === tasklistId)) {
      throw new Error('NOT_FOUND');
    }
    const tasks = listTasks(store, tasklistId);
    const task: GoogleTask = {
      id: `task-${randomUUID()}`,
      title: input.title,
      notes: input.notes,
      status: 'needsAction',
      due: input.due,
      parent: input.parent,
      position: `${Date.now()}`
    };
    tasks.push(task);
    store.tasksByList.set(tasklistId, tasks);
    touchList(store, tasklistId);
    return task;
  },

  patchTask(
    userId: string,
    tasklistId: string,
    taskId: string,
    patch: Partial<Pick<GoogleTask, 'title' | 'notes' | 'due' | 'status' | 'completed'>>
  ): GoogleTask {
    const store = getStore(userId);
    const tasks = listTasks(store, tasklistId);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('NOT_FOUND');
    }
    Object.assign(task, patch);
    store.tasksByList.set(tasklistId, tasks);
    touchList(store, tasklistId);
    return task;
  },

  deleteTask(userId: string, tasklistId: string, taskId: string): void {
    const store = getStore(userId);
    const tasks = listTasks(store, tasklistId);
    const next = tasks.filter((item) => item.id !== taskId);
    if (next.length === tasks.length) {
      throw new Error('NOT_FOUND');
    }
    store.tasksByList.set(tasklistId, next);
    touchList(store, tasklistId);
  },

  completeTask(userId: string, tasklistId: string, taskId: string): GoogleTask {
    return this.patchTask(userId, tasklistId, taskId, {
      status: 'completed',
      completed: new Date().toISOString()
    });
  },

  uncompleteTask(userId: string, tasklistId: string, taskId: string): GoogleTask {
    return this.patchTask(userId, tasklistId, taskId, {
      status: 'needsAction',
      completed: undefined
    });
  },

  moveTask(
    userId: string,
    input: {
      tasklistId: string;
      taskId: string;
      destinationTasklistId?: string;
      previous?: string;
      parent?: string;
    }
  ): GoogleTask {
    const store = getStore(userId);
    const sourceListId = input.tasklistId;
    const destListId = input.destinationTasklistId ?? sourceListId;
    const sourceTasks = listTasks(store, sourceListId);
    const taskIndex = sourceTasks.findIndex((item) => item.id === input.taskId);
    if (taskIndex < 0) {
      throw new Error('NOT_FOUND');
    }
    const [task] = sourceTasks.splice(taskIndex, 1);
    store.tasksByList.set(sourceListId, sourceTasks);

    const destTasks = listTasks(store, destListId);
    if (input.parent) {
      task.parent = input.parent;
    }
    if (input.previous) {
      const prevIndex = destTasks.findIndex((item) => item.id === input.previous);
      const position =
        prevIndex >= 0
          ? `${destTasks[prevIndex].position ?? prevIndex}a`
          : `${Date.now()}`;
      task.position = position;
      destTasks.splice(prevIndex + 1, 0, task);
    } else {
      task.position = `${Date.now()}`;
      destTasks.unshift(task);
    }
    store.tasksByList.set(destListId, destTasks);
    touchList(store, sourceListId);
    if (destListId !== sourceListId) {
      touchList(store, destListId);
    }
    return task;
  },

  clearCompleted(userId: string, tasklistId: string): number {
    const store = getStore(userId);
    seedDefaultLists(store);
    if (!store.tasklists.some((item) => item.id === tasklistId)) {
      throw new Error('NOT_FOUND');
    }
    const tasks = listTasks(store, tasklistId);
    const next = tasks.filter((task) => task.status !== 'completed');
    const deletedCount = tasks.length - next.length;
    store.tasksByList.set(tasklistId, next);
    touchList(store, tasklistId);
    return deletedCount;
  }
};
