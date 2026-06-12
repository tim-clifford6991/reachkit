"use client";
import { useEffect, useState } from "react";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ScanStream({ id }: { id: string }) {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [facts, setFacts] = useState<PreliminaryFacts | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/scan/${id}/stream`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data as string) as ScanEvent;
      if (e.type === "artifact") {
        setArtifacts((a) => [...a, String(e.payload["label"] ?? "working")]);
      } else if (e.type === "facts") {
        setFacts(e.payload as unknown as PreliminaryFacts);
      } else if (e.type === "done" || e.type === "error") {
        es.close();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [id]);

  if (!facts) {
    return (
      <ul className="space-y-2 font-mono text-sm text-muted-foreground">
        {artifacts.length === 0 ? (
          <li>Starting scan…</li>
        ) : (
          artifacts.map((a, i) => <li key={i}>✓ {a}</li>)
        )}
      </ul>
    );
  }

  const isApp = facts.mode === "ios" || facts.mode === "android";
  const ratingDisplay =
    facts.ratingTrend != null ? facts.ratingTrend.toFixed(1) : "—";
  const webScore =
    facts.webProxy != null ? facts.webProxy.score.toFixed(0) : "—";

  return (
    <div className="space-y-4">
      {/* Listing overview */}
      <Card>
        <CardHeader>
          <CardTitle>{facts.listing.name}</CardTitle>
          {facts.listing.category != null && (
            <CardDescription>{facts.listing.category}</CardDescription>
          )}
        </CardHeader>
        {facts.listing.description != null && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {facts.listing.description}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Signal metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Reviews</dt>
            <dd className="font-medium tabular-nums">{facts.reviewVolume}</dd>
            {isApp ? (
              <>
                <dt className="text-muted-foreground">Avg rating</dt>
                <dd className="font-medium tabular-nums">{ratingDisplay}</dd>
              </>
            ) : (
              facts.webProxy != null && (
                <>
                  <dt className="text-muted-foreground">Web score</dt>
                  <dd className="font-medium tabular-nums">{webScore}</dd>
                  <dt className="text-muted-foreground">SERP results</dt>
                  <dd className="font-medium tabular-nums">
                    {facts.webProxy.serpResultCount.toLocaleString()}
                  </dd>
                </>
              )
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Top competitors */}
      {facts.competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top competitors</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {facts.competitors.map((c, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">
                    {c.rank}
                  </span>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {c.source}
                  </Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Theme chips */}
      {facts.themes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {facts.themes.slice(0, 10).map((t, i) => (
                <Badge key={i} variant="secondary">
                  {t.term}
                  <span className="ml-1 text-muted-foreground">{t.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      {facts.sourcesUsed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sources: {facts.sourcesUsed.join(", ")}
        </p>
      )}
    </div>
  );
}
