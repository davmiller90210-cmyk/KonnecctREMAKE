import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type ChatGiphyGifDTO = {
  id: string;
  title: string;
  /** Prefer for chat body (markdown image); Giphy downsized GIF URL. */
  url: string;
  previewUrl: string;
};

type GiphyImagesBlock = {
  fixed_height?: { url?: string };
  downsized?: { url?: string };
  preview_gif?: { url?: string };
};

type GiphyGifBlock = {
  id?: string;
  title?: string;
  images?: GiphyImagesBlock;
};

type GiphyListResponse = {
  data?: GiphyGifBlock[];
};

@Injectable()
export class ChatGiphyService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private getApiKeyOrThrow(): string {
    const key = this.twentyConfigService.get('GIPHY_API_KEY')?.trim();

    if (!key) {
      throw new ServiceUnavailableException(
        'GIF search is not configured (missing GIPHY_API_KEY)',
      );
    }

    return key;
  }

  private mapGif(raw: GiphyGifBlock): ChatGiphyGifDTO | null {
    const id = raw.id?.trim();

    if (!id) {
      return null;
    }

    const images = raw.images ?? {};
    const url =
      images.downsized?.url?.trim() ||
      images.fixed_height?.url?.trim() ||
      images.preview_gif?.url?.trim();

    const previewUrl =
      images.preview_gif?.url?.trim() ||
      images.fixed_height?.url?.trim() ||
      images.downsized?.url?.trim();

    if (!url || !previewUrl) {
      return null;
    }

    return {
      id,
      title: raw.title?.trim() || 'GIF',
      url,
      previewUrl,
    };
  }

  async searchGifs(query: string, limit = 24): Promise<ChatGiphyGifDTO[]> {
    const apiKey = this.getApiKeyOrThrow();
    const capped = Math.min(Math.max(limit, 1), 50);
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query.trim() || 'trending',
      limit: String(capped),
      rating: 'pg-13',
    });
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?${params.toString()}`,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException('Giphy search failed');
    }

    const json = (await response.json()) as GiphyListResponse;
    const list = (json.data ?? [])
      .map((item) => this.mapGif(item))
      .filter((item): item is ChatGiphyGifDTO => item !== null);

    return list;
  }

  async trendingGifs(limit = 24): Promise<ChatGiphyGifDTO[]> {
    const apiKey = this.getApiKeyOrThrow();
    const capped = Math.min(Math.max(limit, 1), 50);
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(capped),
      rating: 'pg-13',
    });
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?${params.toString()}`,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException('Giphy trending failed');
    }

    const json = (await response.json()) as GiphyListResponse;

    return (json.data ?? [])
      .map((item) => this.mapGif(item))
      .filter((item): item is ChatGiphyGifDTO => item !== null);
  }
}
