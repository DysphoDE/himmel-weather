/** Pair only actual timestamps. Never extend a source beyond its coverage. */
export function combineRadarFrames(dwdFrames, worldFrames) {
  const world = new Map(worldFrames.map(frame => [frame.time * 1000, frame]))
  const first = worldFrames[0]?.time * 1000
  const last = worldFrames.at(-1)?.time * 1000
  // In the overlap, use the common cadence; outside it, explicitly use DWD only.
  const frames = dwdFrames.filter(frame =>
    !worldFrames.length || frame.time < first || frame.time > last || world.has(frame.time))
  return { frames, underlay: frames.map(frame => world.get(frame.time) || null) }
}

export const isSettled = status => ['ready', 'error', 'outside'].includes(status)
export function pairStatus(primary, secondary, needsSecondary) {
  return {
    settled: isSettled(primary) && (!needsSecondary || isSettled(secondary)),
    primaryFailed: primary === 'error',
    secondaryFailed: needsSecondary && secondary === 'error'
  }
}
