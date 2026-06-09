import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OfficeSnackResult } from '../api/types';
import { formatWon } from './office-snack-utils';

interface ClosedResultTableProps {
  results: OfficeSnackResult[];
}

const ORDER_BUDGET_WON = 150000;

export function ClosedResultTable({ results }: ClosedResultTableProps) {
  let remainingBudget = ORDER_BUDGET_WON;
  const orderedCandidateIds = new Set<number>();

  for (const result of results) {
    if (result.price <= remainingBudget) {
      orderedCandidateIds.add(result.candidate_id);
      remainingBudget -= result.price;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>최종 결과</CardTitle>
        <p className='text-muted-foreground text-sm'>
          동점일 경우 먼저 등록된 후보가 상위 순위를 가집니다.
        </p>
        <p className='text-muted-foreground text-sm'>
          주문 예산 {formatWon(ORDER_BUDGET_WON)} 기준으로 자동 선별한 주문대상을 표시합니다.
        </p>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className='text-muted-foreground text-sm'>집계된 결과가 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>순위</TableHead>
                <TableHead>간식</TableHead>
                <TableHead>등록자</TableHead>
                <TableHead className='text-right'>1순위</TableHead>
                <TableHead className='text-right'>2순위</TableHead>
                <TableHead className='text-right'>3순위</TableHead>
                <TableHead className='text-right'>총점</TableHead>
                <TableHead className='text-center'>주문대상</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => {
                const isOrdered = orderedCandidateIds.has(result.candidate_id);

                return (
                <TableRow
                  key={result.candidate_id}
                  className={isOrdered ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : undefined}
                >
                  <TableCell className={isOrdered ? 'font-semibold text-emerald-700 dark:text-emerald-300' : undefined}>
                    {result.rank}
                  </TableCell>
                  <TableCell>
                    <div className='space-y-1'>
                      <p className='font-medium'>{result.candidate_name}</p>
                      <a
                        className='text-primary text-xs underline-offset-4 hover:underline'
                        href={result.product_url}
                        target='_blank'
                        rel='noreferrer'
                      >
                        상품 링크
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='space-y-0.5'>
                      <p className='text-sm'>{result.owner_name ?? '알 수 없음'}</p>
                      {result.owner_email ? (
                        <p className='text-muted-foreground text-xs'>{result.owner_email}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>{result.rank1_score}</TableCell>
                  <TableCell className='text-right'>{result.rank2_score}</TableCell>
                  <TableCell className='text-right'>{result.rank3_score}</TableCell>
                  <TableCell className='text-right font-semibold'>
                    {result.total_score}점 / {formatWon(result.price)}
                  </TableCell>
                  <TableCell className='text-center'>
                    {isOrdered ? (
                      <Badge className='bg-emerald-600 text-white hover:bg-emerald-600'>포함</Badge>
                    ) : (
                      <Badge variant='outline'>제외(예산 초과)</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
