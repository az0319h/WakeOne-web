import confetti from 'canvas-confetti';

/** Festive palette — canvas-confetti requires resolved hex colors */
const FIREWORK_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

const CANNON_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42'];

export function getBirthdayConfettiStorageKey(year: number, month: number) {
  return `wakeone:birthday-confetti:${year}-${month}`;
}

/**
 * Card-scoped fireworks — renders only inside the provided canvas.
 * @see https://catdad.github.io/canvas-confetti/
 */
export function fireBirthdayConfetti(canvas: HTMLCanvasElement): () => void {
  const shoot = confetti.create(canvas, {
    resize: true,
    useWorker: false,
    disableForReducedMotion: true
  });

  let cancelled = false;

  shoot({
    particleCount: 100,
    spread: 72,
    origin: { y: 0.58, x: 0.5 },
    colors: CANNON_COLORS
  });

  const cannonEnd = Date.now() + 2200;
  const cannonFrame = () => {
    if (cancelled) {
      return;
    }

    shoot({
      particleCount: 4,
      angle: 60,
      spread: 62,
      origin: { x: 0, y: 0.62 },
      colors: CANNON_COLORS
    });
    shoot({
      particleCount: 4,
      angle: 120,
      spread: 62,
      origin: { x: 1, y: 0.62 },
      colors: CANNON_COLORS
    });

    if (Date.now() < cannonEnd) {
      requestAnimationFrame(cannonFrame);
    }
  };

  cannonFrame();

  const duration = 3_500;
  const animationEnd = Date.now() + duration;
  const defaults = {
    startVelocity: 28,
    spread: 360,
    ticks: 72,
    colors: FIREWORK_COLORS
  };

  const interval = window.setInterval(() => {
    if (cancelled) {
      return;
    }

    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = Math.max(12, 45 * (timeLeft / duration));

    shoot({
      ...defaults,
      particleCount,
      origin: {
        x: randomInRange(0.12, 0.88),
        y: randomInRange(0.15, 0.45)
      }
    });
  }, 280);

  return () => {
    cancelled = true;
    clearInterval(interval);
    shoot.reset();
  };
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
