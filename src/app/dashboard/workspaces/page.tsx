import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Workspaces'
};

export default function WorkspacesPage() {
  return (
    <PageContainer
      pageTitle='Workspaces'
      pageDescription='Workspace UI placeholder for future Supabase organization integration.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Workspace Management</CardTitle>
          <CardDescription>
            This route is kept as a UI shell so it can be connected quickly later.
          </CardDescription>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Organization selector, member roles, and invite flows can be wired here.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
