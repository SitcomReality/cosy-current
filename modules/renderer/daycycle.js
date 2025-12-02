// Day/night cycle and shadow math utilities

export function advanceDayTime(state) {
  state.dayTime = (state.dayTime + state.daySpeed * 0.01) % 1.0;
}

export function getCycleProps(state) {
  const t = state.dayTime;

  let shadowDirX = 0;
  let shadowDirY = 0.4;
  let shadowLength = 0;
  let shadowAlpha = 0;
  let ambientColor = 'transparent';

  if (t < 0.2 || t > 0.8) {
    ambientColor = 'rgba(10, 10, 30, 0.6)';
  } else if (t >= 0.2 && t < 0.3) {
    const p = (t - 0.2) / 0.1;
    ambientColor = `rgba(50, 20, 10, ${0.4 * (1 - p)})`;
  } else if (t >= 0.3 && t < 0.7) {
    ambientColor = 'rgba(0,0,0,0)';
  } else if (t >= 0.7 && t <= 0.8) {
    const p = (t - 0.7) / 0.1;
    ambientColor = `rgba(40, 10, 40, ${0.5 * p})`;
  }

  const isDay = t >= 0.2 && t <= 0.8;
  if (isDay) {
    const dayT = (t - 0.2) / 0.6;
    const edge = Math.abs(dayT - 0.5) * 2;
    shadowLength = edge;
    shadowDirX = dayT < 0.5 ? -1 : 1;
    shadowDirY = 0.4;
    shadowAlpha = 0.25 + 0.2 * edge;
  } else {
    shadowLength = 0.3;
    shadowDirX = 0;
    shadowDirY = 0.4;
    shadowAlpha = 0.1;
  }

  return { shadowDirX, shadowDirY, shadowLength, shadowAlpha, ambientColor };
}

