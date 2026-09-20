import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

import debrecenBoundary from "../../data/debrecenBoundary.json";

export default function MapBoundsController() {
  const map = useMap();

  useEffect(() => {
    const boundaryLayer = L.geoJSON(
      debrecenBoundary as GeoJSON.GeoJsonObject,
    );

    const bounds = boundaryLayer.getBounds();

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, {
      padding: [32, 32],
      maxZoom: 10,
      animate: false,
    });

    // Provide ample buffer (40%) beyond Debrecen city limits so Leaflet auto-pan
    // can smoothly reposition popups without hitting a hard boundary ceiling
    map.setMaxBounds(
      bounds.pad(0.40),
    );

    map.options.maxBoundsViscosity = 0.3;
  }, [map]);

  return null;
}