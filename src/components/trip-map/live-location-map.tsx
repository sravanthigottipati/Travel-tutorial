"use client";

import { useEffect, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useLeafletDefaultIconFix } from "./leaflet-map";

export type LivePoint = { lat: number; lon: number; accuracy: number };

// Frames both points once, when the user's position first arrives — refitting
// on every GPS update would fight the user while they pan the map.
function FitOnFirstFix({ destination, you }: { destination: { lat: number; lon: number }; you: LivePoint | null }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!you || fitted.current) return;
    fitted.current = true;
    map.fitBounds(
      [
        [destination.lat, destination.lon],
        [you.lat, you.lon],
      ],
      { padding: [40, 40], maxZoom: 15 }
    );
  }, [map, destination, you]);
  return null;
}

export default function LiveLocationMap({
  destination,
  you,
}: {
  destination: { lat: number; lon: number; label: string };
  you: LivePoint | null;
}) {
  useLeafletDefaultIconFix();

  return (
    <MapContainer center={[destination.lat, destination.lon]} zoom={11} scrollWheelZoom={false} className="h-72 w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[destination.lat, destination.lon]}>
        <Popup>{destination.label}</Popup>
      </Marker>
      {you && (
        <>
          <Circle center={[you.lat, you.lon]} radius={Math.min(you.accuracy, 2000)} pathOptions={{ color: "#4f46e5", weight: 1, fillOpacity: 0.1 }} />
          <CircleMarker center={[you.lat, you.lon]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#4f46e5", fillOpacity: 1 }}>
            <Popup>You are here</Popup>
          </CircleMarker>
        </>
      )}
      <FitOnFirstFix destination={destination} you={you} />
    </MapContainer>
  );
}
