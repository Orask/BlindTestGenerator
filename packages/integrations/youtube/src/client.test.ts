import { beforeEach, describe, expect, it, vi } from "vitest";

const channelsList = vi.fn();
const playlistItemsList = vi.fn();

vi.mock("@googleapis/youtube", () => ({
  youtube: () => ({
    channels: { list: channelsList },
    playlistItems: { list: playlistItemsList },
  }),
}));

const { createYoutubeClient } = await import("./client.js");

function fakeAuth() {
  return {} as never;
}

describe("createYoutubeClient.hasRecentUploadForTheme", () => {
  beforeEach(() => {
    channelsList.mockReset();
    playlistItemsList.mockReset();
  });

  it("returns true when a same-titled video was published the same UTC day", async () => {
    channelsList.mockResolvedValue({
      data: { items: [{ contentDetails: { relatedPlaylists: { uploads: "PL123" } } }] },
    });
    playlistItemsList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              title: "BLIND TEST Rap US & International 🎧 | Devine 60 chansons (Ép. 1)",
              publishedAt: "2026-10-18T08:21:21.000Z",
            },
          },
        ],
      },
    });

    const client = createYoutubeClient(fakeAuth());
    const result = await client.hasRecentUploadForTheme(
      "Rap US & International",
      new Date("2026-10-18T10:00:00.000Z"),
    );

    expect(result).toBe(true);
  });

  it("returns false when the matching title is from a different day", async () => {
    channelsList.mockResolvedValue({
      data: { items: [{ contentDetails: { relatedPlaylists: { uploads: "PL123" } } }] },
    });
    playlistItemsList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              title: "BLIND TEST Rap US & International 🎧 | Devine 60 chansons (Ép. 1)",
              publishedAt: "2026-10-17T08:21:21.000Z",
            },
          },
        ],
      },
    });

    const client = createYoutubeClient(fakeAuth());
    const result = await client.hasRecentUploadForTheme(
      "Rap US & International",
      new Date("2026-10-18T10:00:00.000Z"),
    );

    expect(result).toBe(false);
  });

  it("returns false when no recent upload's title matches the theme", async () => {
    channelsList.mockResolvedValue({
      data: { items: [{ contentDetails: { relatedPlaylists: { uploads: "PL123" } } }] },
    });
    playlistItemsList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              title: "BLIND TEST Années 80 🎧 | Devine 59 chansons (Ép. 3)",
              publishedAt: "2026-10-18T08:21:21.000Z",
            },
          },
        ],
      },
    });

    const client = createYoutubeClient(fakeAuth());
    const result = await client.hasRecentUploadForTheme(
      "Rap US & International",
      new Date("2026-10-18T10:00:00.000Z"),
    );

    expect(result).toBe(false);
  });

  it("returns false for a same-day Short whose title merely mentions the theme", async () => {
    channelsList.mockResolvedValue({
      data: { items: [{ contentDetails: { relatedPlaylists: { uploads: "PL123" } } }] },
    });
    playlistItemsList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              title: "Tu connais ces pépites Rap FR ? 🎧 #Shorts",
              publishedAt: "2026-10-22T09:50:03.000Z",
            },
          },
        ],
      },
    });

    const client = createYoutubeClient(fakeAuth());
    const result = await client.hasRecentUploadForTheme(
      "Rap FR",
      new Date("2026-10-22T13:00:00.000Z"),
    );

    expect(result).toBe(false);
  });

  it("returns false when the channel has no uploads playlist", async () => {
    channelsList.mockResolvedValue({ data: { items: [] } });

    const client = createYoutubeClient(fakeAuth());
    const result = await client.hasRecentUploadForTheme("Rap US & International", new Date());

    expect(result).toBe(false);
    expect(playlistItemsList).not.toHaveBeenCalled();
  });
});
