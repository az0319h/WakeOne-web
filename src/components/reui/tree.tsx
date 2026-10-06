'use client';

import { createContext, useContext } from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ItemInstance } from '@headless-tree/core';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

type ToggleIconType = 'chevron' | 'plus-minus';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- headless-tree ItemInstance variance
type TreeItemInstance = ItemInstance<any>;

interface TreeContextValue {
  indent: number;
  currentItem?: TreeItemInstance;
  tree?: unknown;
  toggleIconType?: ToggleIconType;
}

const TreeContext = createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  toggleIconType: 'chevron'
});

function useTreeContext() {
  return useContext(TreeContext);
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number;
  tree?: unknown;
  toggleIconType?: ToggleIconType;
}

function Tree({
  indent = 20,
  tree,
  className,
  toggleIconType = 'chevron',
  ...props
}: TreeProps) {
  const containerProps =
    tree && typeof (tree as { getContainerProps?: () => object }).getContainerProps === 'function'
      ? (tree as { getContainerProps: () => object }).getContainerProps()
      : {};
  const mergedProps = { ...props, ...containerProps };

  const { style: propStyle, ...otherProps } = mergedProps;

  const mergedStyle = {
    ...propStyle,
    '--tree-indent': `${indent}px`
  } as React.CSSProperties;

  return (
    <TreeContext.Provider value={{ indent, tree, toggleIconType }}>
      <div
        role='tree'
        data-slot='tree'
        style={mergedStyle}
        className={cn('flex flex-col', className)}
        {...otherProps}
      />
    </TreeContext.Provider>
  );
}

interface TreeItemProps extends Omit<useRender.ComponentProps<'button'>, 'indent'> {
  item: TreeItemInstance;
  indent?: number;
}

function TreeItem({
  item,
  className,
  render,
  children,
  ...props
}: TreeItemProps) {
  const parentContext = useTreeContext();
  const { indent } = parentContext;

  const itemProps = typeof item.getProps === 'function' ? item.getProps() : {};
  const mergedProps = { ...props, children, ...itemProps };

  const { style: propStyle, ...otherProps } = mergedProps;

  const mergedStyle = {
    ...propStyle,
    '--tree-padding': `${item.getItemMeta().level * indent}px`
  } as React.CSSProperties;

  const defaultProps = {
    'data-slot': 'tree-item',
    style: mergedStyle,
    className: cn(
      'z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    ),
    'data-focus':
      typeof item.isFocused === 'function' ? item.isFocused() || false : undefined,
    'data-folder':
      typeof item.isFolder === 'function' ? item.isFolder() || false : undefined,
    'data-selected':
      typeof item.isSelected === 'function' ? item.isSelected() || false : undefined,
    'data-drag-target':
      typeof item.isDragTarget === 'function' ? item.isDragTarget() || false : undefined,
    'data-search-match':
      typeof item.isMatchingSearch === 'function'
        ? item.isMatchingSearch() || false
        : undefined,
    'aria-expanded': item.isExpanded()
  };

  return (
    <TreeContext.Provider value={{ ...parentContext, currentItem: item }}>
      {useRender({
        defaultTagName: 'button',
        render,
        props: mergeProps<'button'>(defaultProps, otherProps)
      })}
    </TreeContext.Provider>
  );
}

interface TreeItemLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  item?: TreeItemInstance;
}

function TreeItemLabel({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps) {
  const { currentItem, toggleIconType } = useTreeContext();
  const item = propItem || currentItem;

  if (!item) {
    return null;
  }

  return (
    <span
      data-slot='tree-item-label'
      className={cn(
        'in-focus-visible:ring-ring/50 bg-background hover:bg-muted/50 in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground in-data-[drag-target=true]:bg-accent flex items-center gap-1 transition-colors not-in-data-[folder=true]:ps-7 in-focus-visible:ring-[3px] in-data-[search-match=true]:bg-blue-50! [&_svg]:pointer-events-none [&_svg]:shrink-0',
        'rounded-md px-2 py-1.5 text-sm',
        className
      )}
      {...props}
    >
      {item.isFolder() &&
        (toggleIconType === 'plus-minus' ? (
          item.isExpanded() ? (
            <Icons.minus className='text-muted-foreground size-3.5' />
          ) : (
            <Icons.add className='text-muted-foreground size-3.5' />
          )
        ) : (
          <Icons.chevronDown
            className={cn(
              'text-muted-foreground size-4 transition-transform',
              !item.isExpanded() && '-rotate-90'
            )}
          />
        ))}
      {children ||
        (typeof item.getItemName === 'function' ? item.getItemName() : null)}
    </span>
  );
}

export { Tree, TreeItem, TreeItemLabel };
