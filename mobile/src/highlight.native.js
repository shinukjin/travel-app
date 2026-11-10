import * as FileSystem from 'expo-file-system/legacy';

function quote(path) {
  return `"${path.replace(/"/g, '\\"')}"`;
}

export async function createHighlightVideo(photos, tripId) {
  if (!photos.length) {
    throw new Error('분류된 사진이 없습니다.');
  }

  let FFmpegKit;
  try {
    ({ FFmpegKit } = require('ffmpeg-kit-react-native'));
  } catch {
    throw new Error('ffmpeg-kit이 없습니다. Android Dev Client로 다시 빌드하세요.');
  }

  const dir = `${FileSystem.cacheDirectory}highlight-${tripId}/`;
  await FileSystem.deleteAsync(dir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const lines = [];
  for (let i = 0; i < Math.min(photos.length, 30); i += 1) {
    const dest = `${dir}${String(i).padStart(3, '0')}.jpg`;
    await FileSystem.copyAsync({ from: photos[i].localUri, to: dest });
    lines.push(`file ${quote(dest.replace('file://', ''))}`);
    lines.push('duration 2');
  }
  lines.push(lines[0]);

  const listFile = `${dir}list.txt`;
  await FileSystem.writeAsStringAsync(listFile, lines.join('\n'));
  const output = `${FileSystem.documentDirectory}highlight-${tripId}.mp4`;
  await FileSystem.deleteAsync(output, { idempotent: true });

  const command = `-y -f concat -safe 0 -i ${quote(listFile.replace('file://', ''))} -vsync vfr -pix_fmt yuv420p -vf scale=720:-2 ${quote(output.replace('file://', ''))}`;
  const session = await FFmpegKit.execute(command);
  const code = await session.getReturnCode();
  if (!code.isValueSuccess()) {
    const logs = await session.getOutput();
    throw new Error(`인코딩 실패: ${logs || code}`);
  }
  return output;
}
