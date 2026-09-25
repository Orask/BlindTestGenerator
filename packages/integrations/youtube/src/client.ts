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
  };
}
