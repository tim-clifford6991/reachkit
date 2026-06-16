import { describe, it, expect } from "vitest";
import { buildShareUrl, deliveryMode } from "./intent";

describe("buildShareUrl", () => {
  it("X: text + url + hashtags, encoded", () => {
    const u = new URL(buildShareUrl("x", { text: "hi there", url: "https://me.com", hashtags: ["#saas", "growth"] }));
    expect(u.origin + u.pathname).toBe("https://twitter.com/intent/tweet");
    expect(u.searchParams.get("text")).toBe("hi there");
    expect(u.searchParams.get("url")).toBe("https://me.com");
    expect(u.searchParams.get("hashtags")).toBe("saas,growth"); // # stripped
  });

  it("Reddit: subreddit submit with title + url (r/ prefix tolerated)", () => {
    const u = new URL(buildShareUrl("reddit", { subreddit: "r/SaaS", title: "Show: my tool", url: "https://me.com" }));
    expect(u.pathname).toBe("/r/SaaS/submit");
    expect(u.searchParams.get("title")).toBe("Show: my tool");
    expect(u.searchParams.get("url")).toBe("https://me.com");
  });

  it("Reddit: no subreddit → general submit", () => {
    expect(buildShareUrl("reddit", { title: "x" })).toContain("https://www.reddit.com/submit?");
  });

  it("LinkedIn + Facebook: URL-only", () => {
    expect(buildShareUrl("linkedin", { text: "ignored", url: "https://me.com" })).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fme.com",
    );
    expect(buildShareUrl("facebook", { url: "https://me.com" })).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fme.com",
    );
  });

  it("WhatsApp folds url into text; email builds a mailto", () => {
    expect(buildShareUrl("whatsapp", { text: "hey", url: "https://me.com" })).toBe(
      "https://wa.me/?text=hey%0Ahttps%3A%2F%2Fme.com",
    );
    const mail = buildShareUrl("email", { title: "Subj", text: "Body", url: "https://me.com" });
    expect(mail.startsWith("mailto:?subject=Subj&body=")).toBe(true);
  });

  it("Telegram + Threads carry url + text", () => {
    expect(buildShareUrl("telegram", { url: "https://me.com", text: "hi" })).toContain("t.me/share/url?");
    expect(buildShareUrl("threads", { text: "hi", url: "https://me.com" })).toContain("threads.net/intent/post?");
  });
});

describe("deliveryMode", () => {
  it("marks LinkedIn/Facebook url-only, others intent", () => {
    expect(deliveryMode("linkedin")).toBe("url-only");
    expect(deliveryMode("facebook")).toBe("url-only");
    expect(deliveryMode("x")).toBe("intent");
    expect(deliveryMode("reddit")).toBe("intent");
  });
});
