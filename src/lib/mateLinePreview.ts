export function clearMateLineTimers(timers: number[]): void {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.length = 0;
}
