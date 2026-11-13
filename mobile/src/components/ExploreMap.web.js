import GoogleMap from './GoogleMap.web';

export default function ExploreMap({ center, places, selectedId, onSelectPlace, compact, inset = 0, onSearchHere }) {
  const markers = (places || []).map((place) => ({ id: place.id, place }));
  const fitKey = center ? `${center.lat},${center.lng}-${markers.length}` : String(markers.length);

  return (
    <GoogleMap
      compact={compact}
      markers={markers}
      center={center}
      fitKey={fitKey}
      inset={inset}
      onSearchHere={onSearchHere}
      controlsTop={inset ? 128 : 16}
      selectedId={selectedId}
      onMarkerPress={(item) => onSelectPlace?.(item.place)}
    />
  );
}
