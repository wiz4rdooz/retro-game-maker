import { t } from '../strings/de';
import type { PlayController } from './playController';

/** Fadenkreuz und Hinweis im Spiel. */
export function PlayOverlay({ play }: { play: PlayController }) {
  const mode = play.lookMode.value;
  return (
    <div class="play-overlay">
      <div class="crosshair" role="img" aria-label={t.play.fadenkreuz} />
      <p class="play-hint">{mode === 'lock' ? t.play.hinweisLock : t.play.hinweisZiehen}</p>
    </div>
  );
}
