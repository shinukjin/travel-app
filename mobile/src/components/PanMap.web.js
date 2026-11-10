import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors } from '../theme';
import { Icon } from '../ui';

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

function project(lat, lng, zoom) {
  const n = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const clamped = Math.min(85.051, Math.max(-85.051, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n;
  return { x, y };
}

function fitTo(markers, width, height) {
  if (!width || !height) return null;
  if (!markers.length) {
    const center = project(41.3874, 2.1686, 13);
    return { zoom: 13, origin: { x: center.x - width / 2, y: center.y - height / 2 } };
  }
  const lats = markers.map((item) => item.place.lat);
  const lngs = markers.map((item) => item.place.lng);
  const pad = 64;
  for (let zoom = 16; zoom >= MIN_ZOOM; zoom -= 1) {
    const topLeft = project(Math.max(...lats), Math.min(...lngs), zoom);
    const bottomRight = project(Math.min(...lats), Math.max(...lngs), zoom);
    const spanX = Math.max(bottomRight.x - topLeft.x, 24);
    const spanY = Math.max(bottomRight.y - topLeft.y, 24);
    if (spanX + pad * 2 <= width && spanY + pad * 2 <= height) {
      return {
        zoom,
        origin: {
          x: topLeft.x + spanX / 2 - width / 2,
          y: topLeft.y + spanY / 2 - height / 2
        }
      };
    }
  }
  const topLeft = project(Math.max(...lats), Math.min(...lngs), MIN_ZOOM);
  const bottomRight = project(Math.min(...lats), Math.max(...lngs), MIN_ZOOM);
  return {
    zoom: MIN_ZOOM,
    origin: {
      x: (topLeft.x + bottomRight.x) / 2 - width / 2,
      y: (topLeft.y + bottomRight.y) / 2 - height / 2
    }
  };
}

function tilesFor(zoom, origin, width, height) {
  if (!width || !height) return [];
  const n = 2 ** zoom;
  const minX = Math.floor(origin.x / TILE) - 1;
  const minY = Math.floor(origin.y / TILE) - 1;
  const maxX = Math.ceil((origin.x + width) / TILE) + 1;
  const maxY = Math.ceil((origin.y + height) / TILE) + 1;
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (y < 0 || y >= n) continue;
      const wrappedX = ((x % n) + n) % n;
      tiles.push({
        key: `${zoom}:${wrappedX}:${y}:${Math.floor(x / n)}`,
        left: x * TILE - origin.x,
        top: y * TILE - origin.y,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`
      });
    }
  }
  return tiles;
}

export default function PanMap({ markers, fitKey, onRecenterRequest, onMarkerPress, selectedId }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(13);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const originRef = useRef(origin);
  const zoomRef = useRef(zoom);
  const startRef = useRef(null);
  const fittedRef = useRef('');
  originRef.current = origin;
  zoomRef.current = zoom;

  const applyFit = useCallback((nextMarkers, width, height) => {
    const next = fitTo(nextMarkers, width, height);
    if (!next) return;
    setZoom(next.zoom);
    setOrigin(next.origin);
  }, []);

  useEffect(() => {
    const key = `${fitKey}|${size.w}x${size.h}`;
    if (!size.w || fittedRef.current === key) return;
    fittedRef.current = key;
    applyFit(markers, size.w, size.h);
  }, [applyFit, fitKey, markers, size]);

  const zoomAt = useCallback((cx, cy, dir) => {
    const current = zoomRef.current;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + dir));
    if (nextZoom === current) return;
    const currentOrigin = originRef.current;
    const scale = 2 ** (nextZoom - current);
    setZoom(nextZoom);
    setOrigin({
      x: (currentOrigin.x + cx) * scale - cx,
      y: (currentOrigin.y + cy) * scale - cy
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        startRef.current = { ...originRef.current };
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        if (!startRef.current) return;
        setOrigin({
          x: startRef.current.x - gesture.dx,
          y: startRef.current.y - gesture.dy
        });
      },
      onPanResponderRelease: () => {
        startRef.current = null;
        setDragging(false);
      },
      onPanResponderTerminate: () => {
        startRef.current = null;
        setDragging(false);
      }
    })
  ).current;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onWheel = (event) => {
      const node = document.querySelector('[data-pan-map="canvas"]');
      if (!node || !node.contains(event.target)) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY > 0 ? -1 : 1);
    };
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, [zoomAt]);

  const tiles = useMemo(
    () => tilesFor(zoom, origin, size.w, size.h),
    [zoom, origin, size]
  );

  return (
    <View
      style={styles.host}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ w: Math.round(width), h: Math.round(height) });
      }}
    >
      <View
        dataSet={{ panMap: 'canvas' }}
        accessibilityRole="image"
        accessibilityLabel="지도"
        style={[styles.canvas, { cursor: dragging ? 'grabbing' : 'grab' }]}
        {...panResponder.panHandlers}
      >
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={[styles.tile, { left: tile.left, top: tile.top }]}
          />
        ))}
        {markers.map((item, index) => {
          const point = project(item.place.lat, item.place.lng, zoom);
          const selected = selectedId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onMarkerPress?.(item)}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${item.place?.name || '장소'}`}
              style={[
                styles.pinWrap,
                { left: point.x - origin.x - 14, top: point.y - origin.y - 28 },
                selected && styles.pinWrapSelected
              ]}
            >
              <View style={[styles.pin, selected && styles.pinSelected]}>
                <Text style={styles.pinText}>{index + 1}</Text>
              </View>
              <View style={[styles.pinDot, selected && styles.pinDotSelected]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.zoom} pointerEvents="box-none">
        <Pressable
          style={styles.zoomBtn}
          onPress={() => zoomAt(size.w / 2, size.h / 2, 1)}
          accessibilityRole="button"
          accessibilityLabel="확대"
        >
          <Icon name="add" size={18} color={colors.ink} />
        </Pressable>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => zoomAt(size.w / 2, size.h / 2, -1)}
          accessibilityRole="button"
          accessibilityLabel="축소"
        >
          <Icon name="remove" size={18} color={colors.ink} />
        </Pressable>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => {
            fittedRef.current = '';
            applyFit(markers, size.w, size.h);
            onRecenterRequest?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="일정 위치로"
        >
          <Icon name="locate" size={16} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.credit}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: '#DCE6D8',
    overflow: 'hidden',
    position: 'relative'
  },
  canvas: { flex: 1, overflow: 'hidden', touchAction: 'none', userSelect: 'none' },
  tile: {
    position: 'absolute',
    width: TILE,
    height: TILE
  },
  pinWrap: {
    position: 'absolute',
    width: 28,
    alignItems: 'center'
  },
  pinWrapSelected: { zIndex: 5 },
  pinSelected: {
    backgroundColor: colors.ink,
    transform: [{ scale: 1.12 }]
  },
  pinDotSelected: { backgroundColor: colors.ink },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white'
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: -2
  },
  pinText: { color: 'white', fontWeight: '800', fontSize: 12 },
  zoom: {
    position: 'absolute',
    left: 12,
    top: 16,
    gap: 8
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  credit: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    fontSize: 9,
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  }
});
