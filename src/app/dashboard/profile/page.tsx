import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Profile'
};

export default function ProfilePage() {
  return (
    <PageContainer
      pageTitle='Profile'
      pageDescription='User profile UI placeholder page for future Supabase user settings.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            This page is preserved as a UI shell so profile features can be reconnected quickly.
          </CardDescription>
        </CardHeader>
        <CardContent className='text-muted-foreground text-sm'>
          Add account preferences, avatar upload, and security settings once APIs are ready.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
