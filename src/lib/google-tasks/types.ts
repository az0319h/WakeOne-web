export type GoogleTaskList = {
  id: string;
  title: string;
  updated?: string;
  /** Google `@default` list — API cannot delete it. */
  isDefault?: boolean;
};

export type GoogleTaskStatus = 'needsAction' | 'completed';

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  status: GoogleTaskStatus;
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  /** Google tasks.clear marks completed items hidden; omit from UI when true. */
  hidden?: boolean;
  deleted?: boolean;
};

export type GoogleTaskListListResponse = {
  items?: GoogleTaskList[];
  nextPageToken?: string;
};

export type GoogleTaskListResponse = {
  items?: GoogleTask[];
  nextPageToken?: string;
};

export class GoogleTasksApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GoogleTasksApiError';
    this.status = status;
    this.code = code;
  }
}
