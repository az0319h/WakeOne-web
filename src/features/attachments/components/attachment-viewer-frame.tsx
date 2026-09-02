type AttachmentViewerFrameProps = {
  src: string;
  fileName: string;
};

export function AttachmentViewerFrame({ src, fileName }: AttachmentViewerFrameProps) {
  return (
    <iframe src={src} title={fileName} className='h-dvh w-full border-0' />
  );
}
