declare module 'd3-org-chart' {
  export class OrgChart<T extends Record<string, unknown>> {
    container(value: HTMLElement | string): this;
    data(value: T[]): this;
    nodeWidth(value: (node: { data: T }) => number): this;
    nodeHeight(value: (node: { data: T }) => number): this;
    childrenMargin(value: (node: { data: T }) => number): this;
    compact(value: boolean): this;
    nodeContent(value: (node: { data: T }) => string): this;
    render(): this;
    fit(): this;
    expandAll(): this;
    zoomIn?(): void;
    zoomOut?(): void;
  }
}
