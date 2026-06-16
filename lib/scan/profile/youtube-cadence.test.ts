import { describe, it, expect } from "vitest";
import {
  parseChannelRef,
  channelListParam,
  parseUploadsPlaylist,
  parsePlaylistDates,
} from "./youtube-cadence";

describe("parseChannelRef", () => {
  it("parses channel id, handle, and custom/user URLs", () => {
    expect(parseChannelRef("https://www.youtube.com/channel/UC123abc")).toEqual({
      kind: "id",
      value: "UC123abc",
    });
    expect(parseChannelRef("https://youtube.com/@stripe")).toEqual({
      kind: "handle",
      value: "@stripe",
    });
    expect(parseChannelRef("https://www.youtube.com/c/wiseaccount")).toEqual({
      kind: "user",
      value: "wiseaccount",
    });
    expect(parseChannelRef("https://www.youtube.com/user/google")).toEqual({
      kind: "user",
      value: "google",
    });
  });
  it("returns null for a non-channel URL", () => {
    expect(parseChannelRef("https://example.com")).toBeNull();
  });
});

describe("channelListParam", () => {
  it("maps each ref kind to the right channels.list param", () => {
    expect(channelListParam({ kind: "id", value: "UC1" })).toBe("id=UC1");
    expect(channelListParam({ kind: "handle", value: "@stripe" })).toBe("forHandle=%40stripe");
    expect(channelListParam({ kind: "user", value: "wise" })).toBe("forUsername=wise");
  });
});

describe("parseUploadsPlaylist", () => {
  it("extracts the uploads playlist id", () => {
    const body = { items: [{ contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] };
    expect(parseUploadsPlaylist(body)).toBe("UU123");
  });
  it("returns null when absent", () => {
    expect(parseUploadsPlaylist({ items: [] })).toBeNull();
    expect(parseUploadsPlaylist(null)).toBeNull();
  });
});

describe("parsePlaylistDates", () => {
  it("pulls publishedAt from playlist items", () => {
    const body = {
      items: [
        { snippet: { publishedAt: "2026-06-01T00:00:00Z" } },
        { snippet: { publishedAt: "2026-05-01T00:00:00Z" } },
        { snippet: {} },
      ],
    };
    expect(parsePlaylistDates(body)).toEqual(["2026-06-01T00:00:00Z", "2026-05-01T00:00:00Z"]);
  });
  it("returns [] for an empty body", () => {
    expect(parsePlaylistDates({})).toEqual([]);
  });
});
