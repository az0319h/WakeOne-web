import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Billing'
};

export default function BillingPage() {
  return (
    <PageContainer
      pageTitle='Billing'
      pageDescription='Billing UI placeholder page for future subscription integration.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Billing Overview</CardTitle>
          <CardDescription>
            This page is intentionally preserved to keep the billing UI route active.
          </CardDescription>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Add plan cards, invoices, and payment method management when backend is ready.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
