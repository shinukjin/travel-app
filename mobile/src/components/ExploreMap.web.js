import GoogleMap from './GoogleMap.web';

export default function ExploreMap({ center, places, selectedId, onSelectPlace, compact }) {
  const markers = (places || []).map((place) => ({ id: place.id, place }));
  const fitKey = center ? `${center.lat},${center.lng}-${markers.length}` : String(markers.length);

  return (
    <GoogleMap
      compact={compact}
      markers={markers}
      center={center}
      fitKey={fitKey}
      selectedId={selectedId}
      onMarkerPress={(item) => onSelectPlace?.(item.place)}
    />
  );
}
