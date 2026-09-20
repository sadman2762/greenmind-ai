import React from "react";
import { GeoJSON } from "react-leaflet";
import boundary from "../../data/debrecenBoundary.json";

const DebrecenBoundary = React.memo(function DebrecenBoundary() {
  return (
    <GeoJSON
      data={boundary as GeoJSON.GeoJsonObject}
      style={{
        color: "#1565c0",
        weight: 3,
        opacity: 1,
        fillColor: "#1565c0",
        fillOpacity: 0.05,
      }}
    />
  );
});

export default DebrecenBoundary;