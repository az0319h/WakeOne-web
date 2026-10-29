import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { isAssetManager } from '@/features/auth/api/asset-access.server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import {
  AssetLedgerCreateButton,
  AssetLedgerSheetProvider
} from '@/features/asset-ledger/components/asset-ledger-sheet-context';
import { EquipmentPage } from '@/features/equipment/components/equipment-page';
import { searchParamsCache } from '@/lib/searchparams';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/**
 * plan 103 — 비품 관리. 동방특송은 proxy allowlist가 막는다(새 규칙 없음) · 일반 직원도 연다.
 * 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀)만 「비품 추가」·관리 정보·수정·삭제가 렌더된다.
 */
export default async function EquipmentPageRoute(props: PageProps) {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/auth/sign-in');
  }
  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  searchParamsCache.parse(await props.searchParams);
  const isManager = isAssetManager(profile);

  return (
    <AssetLedgerSheetProvider>
      <PageContainer
        pageTitle='비품 관리'
        pageDescription='회사 전산장비와 쓰는 사람을 봅니다. 고장·교체·반납은 줄을 눌러 요청하세요.'
        pageHeaderAction={
          isManager ? (
            <AssetLedgerCreateButton label='비품 추가' data-testid='equipment-create-button' />
          ) : undefined
        }
      >
        <EquipmentPage isManager={isManager} />
      </PageContainer>
    </AssetLedgerSheetProvider>
  );
}
