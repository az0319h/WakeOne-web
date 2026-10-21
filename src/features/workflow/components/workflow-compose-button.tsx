'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useWorkflowCompose } from './workflow-compose-context';

/** PageContainer 헤더 「문서 작성하기」 → 양식 선택 */
export function WorkflowComposeButton() {
  const { setPickerOpen } = useWorkflowCompose();
  return (
    <Button
      type='button'
      data-testid='workflow-compose-button'
      aria-label='문서 작성하기'
      className='h-10 md:h-9'
      onClick={() => setPickerOpen(true)}
    >
      <Icons.edit aria-hidden />
      <span className='hidden sm:inline'>문서 작성하기</span>
      <span className='sm:hidden'>작성</span>
    </Button>
  );
}
