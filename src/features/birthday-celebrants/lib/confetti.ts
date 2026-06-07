import confetti from 'canvas-confetti';

/** Festive palette — canvas-confetti requires resolved hex colors */
const FIREWORK_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

const CANNON_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42'];

export function getBirthdayConfettiStorageKey(year: number, month: number) {
  return `wakeone:birthday-confetti:${year}-${month}`;
}

/**
 * Payment-success style side cannons + canvas-confetti fireworks burst.
 * @see https://catdad.github.io/canvas-confetti/
 */
export function fireBirthdayConfetti() {
  const zIndex = 9999;

  confetti({
    particleCount: 100,
    spread: 72,
    origin: { y: 0.58, x: 0.5 },
    colors: CANNON_COLORS,
    disableForReducedMotion: true,
    zIndex
  });

  const cannonEnd = Date.now() + 2200;
  const cannonFrame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 62,
      origin: { x: 0, y: 0.62 },
      colors: CANNON_COLORS,
      disableForReducedMotion: true,
      zIndex
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 62,
      origin: { x: 1, y: 0.62 },
      colors: CANNON_COLORS,
      disableForReducedMotion: true,
      zIndex
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
    zIndex,
    disableForReducedMotion: true,
    colors: FIREWORK_COLORS
  };

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = Math.max(12, 45 * (timeLeft / duration));

    confetti({
      ...defaults,
      particleCount,
      origin: {
        x: randomInRange(0.12, 0.88),
        y: randomInRange(0.15, 0.45)
      }
    });
  }, 280);
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
