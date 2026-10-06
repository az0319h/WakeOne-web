'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react';
import type { OrgChartNode } from '../api/types';

export type PersonContactInfo = {
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
};

const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 100;

function buildContactIndex(nodes: OrgChartNode[]): Map<string, PersonContactInfo> {
  const map = new Map<string, PersonContactInfo>();

  for (const node of nodes) {
    if (node.nodeType !== 'person' || !node.userId) {
      continue;
    }

    map.set(node.userId, {
      avatarUrl: node.avatarUrl ?? null,
      email: node.email ?? null,
      phone: node.phone ?? null,
      fullName: node.fullName ?? node.name
    });
  }

  return map;
}

function findPersonElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest('[data-org-chart-person]');
  return element instanceof HTMLElement ? element : null;
}

export function useOrgChartPersonHover(
  containerRef: RefObject<HTMLDivElement | null>,
  nodes: OrgChartNode[]
) {
  const contactIndex = useMemo(() => buildContactIndex(nodes), [nodes]);
  const contactIndexRef = useRef(contactIndex);
  contactIndexRef.current = contactIndex;

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeImmediately = useCallback(() => {
    clearTimers();
    hoveredElementRef.current = null;
    setActiveUserId(null);
    setAnchorRect(null);
  }, [clearTimers]);

  const scheduleOpen = useCallback(
    (element: HTMLElement, userId: string) => {
      clearTimers();
      hoveredElementRef.current = element;

      openTimerRef.current = setTimeout(() => {
        if (hoveredElementRef.current !== element) {
          return;
        }

        setActiveUserId(userId);
        setAnchorRect(element.getBoundingClientRect());
      }, OPEN_DELAY_MS);
    },
    [clearTimers]
  );

  const scheduleClose = useCallback(() => {
    clearTimers();

    closeTimerRef.current = setTimeout(() => {
      hoveredElementRef.current = null;
      setActiveUserId(null);
      setAnchorRect(null);
    }, CLOSE_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!activeUserId || !hoveredElementRef.current) {
      return;
    }

    const updateAnchor = () => {
      if (hoveredElementRef.current) {
        setAnchorRect(hoveredElementRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', updateAnchor, true);
    window.addEventListener('resize', updateAnchor);

    return () => {
      window.removeEventListener('scroll', updateAnchor, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [activeUserId]);

  useEffect(() => {
    if (activeUserId && !contactIndex.has(activeUserId)) {
      closeImmediately();
    }
  }, [activeUserId, contactIndex, closeImmediately]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleMouseOver = (event: MouseEvent) => {
      const personElement = findPersonElement(event.target);
      if (!personElement) {
        return;
      }

      const userId = personElement.dataset.userId;
      if (!userId || !contactIndexRef.current.has(userId)) {
        return;
      }

      scheduleOpen(personElement, userId);
    };

    const handleMouseOut = (event: MouseEvent) => {
      const personElement = findPersonElement(event.target);
      if (!personElement) {
        return;
      }

      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && personElement.contains(relatedTarget)) {
        return;
      }

      scheduleClose();
    };

    const handleWheel = () => {
      closeImmediately();
    };

    const handleScroll = () => {
      closeImmediately();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!findPersonElement(event.target)) {
        closeImmediately();
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimers();
    };
  }, [containerRef, scheduleOpen, scheduleClose, closeImmediately, clearTimers, nodes]);

  const activeContact = activeUserId ? (contactIndex.get(activeUserId) ?? null) : null;

  return {
    activeUserId,
    activeContact,
    anchorRect,
    closeImmediately,
    isOpen: activeUserId !== null
  };
}
