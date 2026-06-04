import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Exclusive'
};

export default function ExclusivePage() {
  return (
    <PageContainer
      pageTitle='Exclusive'
      pageDescription='Premium feature UI placeholder kept for future activation.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Exclusive Features</CardTitle>
          <CardDescription>
            This route remains available so premium UI can be connected without rebuilding pages.
          </CardDescription>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Add feature-gated components and entitlement checks when needed.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
