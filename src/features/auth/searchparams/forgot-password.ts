import { createSearchParamsCache, parseAsString } from 'nuqs/server';

export const forgotPasswordSearchParams = {
  email: parseAsString
};

export const forgotPasswordSearchParamsCache = createSearchParamsCache(
  forgotPasswordSearchParams
);
