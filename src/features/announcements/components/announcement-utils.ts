export function getAnnouncementBodyExcerpt(body: string, maxLength = 80): string {
  const singleLine = body.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength)}…`;
}

export function isAnnouncementUpdated(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime();
}
