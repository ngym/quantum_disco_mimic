// 8曲の合成ビルダーが実行時エラーなく1ループ分をスケジュールできることの検証
import { installAudioMocks, audioStats } from './mocks.mjs';
import { check, finish } from './helpers.mjs';

installAudioMocks();
const { renderSong, SONG_META, LOOP_SECONDS } = await import('../js/audio/songs.js');

for (let i = 0; i < SONG_META.length; i++) {
  audioStats.reset();
  try {
    const buf = await renderSong(i, 44100);
    check(`曲${SONG_META[i].bits}「${SONG_META[i].name}」(${audioStats.sourceNodes} 音源ノード)`,
      buf.duration === LOOP_SECONDS && audioStats.sourceNodes >= 20);
  } catch (e) {
    check(`曲${SONG_META[i].bits}「${SONG_META[i].name}」`, false, e.message);
  }
}
finish();
