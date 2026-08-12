import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/auth/sign-in`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1
    }
  ];
}
