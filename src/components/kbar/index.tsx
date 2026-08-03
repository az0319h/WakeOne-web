'use client';
import { navGroups } from '@/config/nav-config';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarSearch
} from 'kbar';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { getKbarNavKeywords } from './kbar-nav-synonyms';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';

export default function KBar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const filteredGroups = useFilteredNavGroups(navGroups);

  const actions = useMemo(() => {
    const navigateTo = (url: string) => {
      router.push(url);
    };

    return filteredGroups.flatMap((group) =>
      group.items.flatMap((navItem) => {
        const keywords = getKbarNavKeywords(navItem.title, group.label);

        const baseAction =
          navItem.url !== '#'
            ? {
                id: `${navItem.title.toLowerCase()}Action`,
                name: navItem.title,
                shortcut: navItem.shortcut,
                keywords,
                section: 'Navigation',
                subtitle: navItem.title,
                perform: () => navigateTo(navItem.url)
              }
            : null;

        const childActions =
          navItem.items?.map((childItem) => ({
            id: `${childItem.title.toLowerCase()}Action`,
            name: childItem.title,
            shortcut: childItem.shortcut,
            keywords: getKbarNavKeywords(childItem.title, group.label),
            section: 'Navigation',
            subtitle: childItem.title,
            perform: () => navigateTo(childItem.url)
          })) ?? [];

        return baseAction ? [baseAction, ...childActions] : childActions;
      })
    );
  }, [router, filteredGroups]);

  return (
    <KBarProvider actions={actions}>
      <KBarComponent>{children}</KBarComponent>
    </KBarProvider>
  );
}

function KBarComponent({ children }: { children: React.ReactNode }) {
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className='bg-background/80 fixed inset-0 z-99999 p-0! backdrop-blur-sm'>
          <KBarAnimator className='bg-card text-card-foreground relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border shadow-lg'>
            <div className='bg-card border-border sticky top-0 z-10 border-b'>
              <KBarSearch
                data-testid='kbar-search-input'
                className='bg-card w-full border-none px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden'
              />
            </div>
            <div className='max-h-[400px]'>
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
}
