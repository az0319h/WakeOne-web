export default function OrgChartLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='flex max-h-[calc(100dvh-4rem)] min-h-0 flex-1 flex-col overflow-y-auto md:max-h-[calc(100dvh-3.5rem)]'>
      {children}
    </div>
  );
}
