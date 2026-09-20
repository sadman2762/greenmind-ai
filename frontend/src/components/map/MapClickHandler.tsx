import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { isInsideDebrecenBoundary } from "../../utils/isInsideDebrecenBoundary";
import { useSimulation } from "../../context/SimulationContext";
import type { Station } from "../../types/station";
import type { SensorTier } from "../../types/budget";

interface MapClickHandlerProps {
  stations: Station[];
  onInvalidLocation?: () => void;
  onPinAdded?: (lat: number, lng: number, tier: SensorTier) => void;
}

export default function MapClickHandler({
  stations,
  onInvalidLocation,
  onPinAdded,
}: MapClickHandlerProps) {
  const { isPlacingCustomPin, addCustomPin, customPinTier } = useSimulation();
  const map = useMap();

  // Change cursor when placing pin
  useEffect(() => {
    const container = map.getContainer();
    if (isPlacingCustomPin) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [isPlacingCustomPin, map]);

  useMapEvents({
    click(e) {
      if (!isPlacingCustomPin) return;

      const { lat, lng } = e.latlng;

      if (!isInsideDebrecenBoundary(lat, lng)) {
        if (onInvalidLocation) {
          onInvalidLocation();
        }
        return;
      }

      addCustomPin(lat, lng, stations, customPinTier);

      if (onPinAdded) {
        onPinAdded(lat, lng, customPinTier);
      }
    },
  });

  return null;
}
