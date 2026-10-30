'use client';

import { parseAsStringLiteral, useQueryStates } from 'nuqs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ORG_AFFILIATION_OPTIONS } from '@/features/users/constants/organization';

const affiliationValues = ['wake', 'sans', 'sans_foundry'] as const;

const affiliationParser = parseAsStringLiteral(affiliationValues).withDefault('wake');

export function useOrgChartAffiliation() {
  return useQueryStates(
    { affiliation: affiliationParser },
    { shallow: true }
  );
}

export function OrgChartTabs() {
  const [{ affiliation }, setParams] = useOrgChartAffiliation();

  return (
    <Tabs
      value={affiliation}
      onValueChange={(value) => {
        if (
          value === 'wake' ||
          value === 'sans' ||
          value === 'sans_foundry'
        ) {
          void setParams({ affiliation: value });
        }
      }}
    >
      <TabsList className='max-md:h-auto'>
        {ORG_AFFILIATION_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className='max-md:h-11'>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
