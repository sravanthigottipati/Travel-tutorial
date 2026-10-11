"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { directionsUrl, distanceKm } from "@/lib/planner/trip-tracking";
import type { LivePoint } from "@/components/trip-map/live-location-map";

const LiveLocationMap = dynamic(() => import("@/components/trip-map/live-location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const GEO_ERRORS: Record<number, string> = {
  1: "Location access was blocked. Allow it from the lock icon in the address bar, then try again.",
  2: "Your location isn't available right now (no GPS or network fix).",
  3: "Finding your location took too long. Try again outdoors or with better signal.",
};

// Position is read and shown only in this browser — it is never sent to the server.
export function LiveLocationCard({
  destination,
  nextPlace,
}: {
  destination: { lat: number; lon: number; label: string } | null;
  nextPlace: string | null;
}) {
  const [you, setYou] = useState<(LivePoint & { at: number }) | null>(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
  }

  function start() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This browser can't share its location.");
      return;
    }
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) =>
        setYou({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        }),
      (err) => {
        setError(GEO_ERRORS[err.code] ?? "Couldn't get your location.");
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
  }

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    []
  );

  const km = you && destination ? distanceKm(you, destination) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where am I?</CardTitle>
        <CardDescription>
          Live location on your trip map. It stays on this device and is never sent to Travel Tutorial.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {watching ? (
            <Button variant="outline" size="sm" onClick={stop}>
              Stop sharing location
            </Button>
          ) : (
            <Button size="sm" onClick={start}>
              Show my location
            </Button>
          )}
          {nextPlace && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={directionsUrl(nextPlace)} target="_blank" rel="noreferrer">
                  Directions to next stop
                </a>
              }
            />
          )}
          {watching && !you && !error && <span className="text-sm text-muted-foreground">Finding you…</span>}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {you && (
          <p className="text-sm">
            {km !== null && destination && (
              <>
                You&apos;re <strong>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</strong> from{" "}
                {destination.label}.{" "}
              </>
            )}
            <span className="text-muted-foreground">
              Accurate to about {Math.round(you.accuracy)} m · updated{" "}
              {new Date(you.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        )}

        {destination ? (
          <LiveLocationMap destination={destination} you={you} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No map location is known for this destination, so there&apos;s no map here — directions to your next stop still work.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
