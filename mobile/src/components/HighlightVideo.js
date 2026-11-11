import { useVideoPlayer, VideoView } from 'expo-video';

/** 하이라이트 mp4 미리보기 (expo-video — expo-av 대체) */
export function HighlightVideo({ uri, style }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}
