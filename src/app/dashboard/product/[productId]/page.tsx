import { notFound, redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: 비품 대장'
};

type PageProps = { params: Promise<{ productId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  if (params.productId === 'new') {
    redirect('/dashboard/product');
  }

  notFound();
}
