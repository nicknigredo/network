import React from 'react';
import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Интерфейс для пропсов Map-компонентов
interface MapEventHandlerProps {
  onMapClick: (pos: [number, number]) => void;
  enabled: boolean;
}

interface AddOnMapProps {
  onMapClick: (pos: [number, number]) => void;
  enabled: boolean;
}

const AddOnMapHandler = ({ onMapClick, enabled }: AddOnMapProps) => {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
};

interface AddBoxOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddBoxOnMap({ onMapClick, enabled }: AddBoxOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface AddCableOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddCableOnMap({ onMapClick, enabled }: AddCableOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface AddPoleOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddPoleOnMap({ onMapClick, enabled }: AddPoleOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface AddWellOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddWellOnMap({ onMapClick, enabled }: AddWellOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface AddSpliceClosureOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddSpliceClosureOnMap({ onMapClick, enabled }: AddSpliceClosureOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

interface AddAtsOnMapProps {
  onMapClick: (position: [number, number]) => void;
  enabled: boolean;
}

export function AddAtsOnMap({ onMapClick, enabled }: AddAtsOnMapProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
} 