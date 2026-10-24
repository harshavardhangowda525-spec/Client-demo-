import type { getStudioHome, getStudioPortfolio, getStudioService, listStudioServices, searchStudio, StudioServiceCard } from '@studio/core';

export type { StudioServiceCard };
export type StudioHome = Awaited<ReturnType<typeof getStudioHome>>;
export type StudioListing = Awaited<ReturnType<typeof listStudioServices>>;
export type StudioService = Awaited<ReturnType<typeof getStudioService>>;
export type StudioSearch = Awaited<ReturnType<typeof searchStudio>>;
export type StudioPortfolio = Awaited<ReturnType<typeof getStudioPortfolio>>;
export type StudioCategory = { slug: string; name: string; description: string | null; imageKey: string | null };
