import { createReadStream } from "node:fs";
import { youtube } from "@googleapis/youtube";
import type { OAuth2Client } from "google-auth-library";
import type { UploadVideoParams, YoutubeClient } from "./types.js";

export function createYoutubeClient(auth: OAuth2Client): YoutubeClient {
  const api = youtube({ version: "v3", auth });

  return {
    async uploadVideo(params: UploadVideoParams): Promise<{ videoId: string }> {
      const response = await api.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: params.title,
            description: params.description,
            tags: [...params.tags],
          },
          status: params.publishAt
            ? { privacyStatus: "private", publishAt: params.publishAt.toISOString() }
            : { privacyStatus: params.visibility },
        },
        media: {
          body: createReadStream(params.filePath),
        },
      });

      const videoId = response.data.id;
      if (!videoId) {
        throw new Error("YouTube upload succeeded but returned no video id.");
      }
      return { videoId };
    },

    async setThumbnail(videoId: string, filePath: string): Promise<void> {
      await api.thumbnails.set({
        videoId,
        media: { body: createReadStream(filePath) },
      });
    },

    async ensurePlaylist(title: string): Promise<{ playlistId: string }> {
      const existing = await api.playlists.list({
        part: ["snippet"],
        mine: true,
        maxResults: 50,
      });
      const match = existing.data.items?.find((item) => item.snippet?.title === title);
      if (match?.id) {
        return { playlistId: match.id };
      }

      const created = await api.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: { title },
          status: { privacyStatus: "public" },
        },
      });
      const playlistId = created.data.id;
      if (!playlistId) {
        throw new Error("YouTube playlist creation succeeded but returned no playlist id.");
      }
      return { playlistId };
    },

    async addVideoToPlaylist(videoId: string, playlistId: string): Promise<void> {
      await api.playlistItems.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: { kind: "youtube#video", videoId },
          },
        },
      });
    },

    async deleteVideo(videoId: string): Promise<void> {
      await api.videos.delete({ id: videoId });
    },

    async hasRecentUploadForTheme(
      themeLabel: string,
      referenceDate: Date,
      maxResults = 10,
    ): Promise<boolean> {
      const channelResponse = await api.channels.list({ part: ["contentDetails"], mine: true });
      const uploadsPlaylistId =
        channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        return false;
      }

      const itemsResponse = await api.playlistItems.list({
        part: ["snippet"],
        playlistId: uploadsPlaylistId,
        maxResults,
      });

      // Matches only a long-form episode's own title (every one starts
      // with this exact prefix, see buildYoutubeMetadata) — a plain
      // `title.includes(themeLabel)` also matched unrelated Shorts whose
      // title happens to mention the theme (confirmed live: a "Tu connais
      // ces pépites Rap FR ?" Short published the same day made this
      // return true for the "Rap FR" long episode even though no long
      // episode had actually gone out, skipping a legitimate catch-up run).
      const referenceDay = referenceDate.toISOString().slice(0, 10);
      const titlePrefix = `BLIND TEST ${themeLabel}`;
      return (itemsResponse.data.items ?? []).some((item) => {
        const title = item.snippet?.title ?? "";
        const publishedAt = item.snippet?.publishedAt;
        if (!publishedAt || !title.startsWith(titlePrefix)) {
          return false;
        }
        return publishedAt.slice(0, 10) === referenceDay;
      });
    },

    async getBlockedRegionCounts(videoIds: readonly string[]): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      const ids = [...videoIds];
      // videos.list caps at 50 ids per call, same limit as every other
      // batched list endpoint in this API.
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const response = await api.videos.list({ part: ["contentDetails"], id: batch });
        for (const item of response.data.items ?? []) {
          if (item.id) {
            counts.set(item.id, item.contentDetails?.regionRestriction?.blocked?.length ?? 0);
          }
        }
      }
      return counts;
    },
  };
}
