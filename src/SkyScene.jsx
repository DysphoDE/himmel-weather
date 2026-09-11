import { useMemo } from 'react'
import { weatherKind } from './weather'

/**
 * Generierte Landschaft anstelle des festen KI-Bildes.
 *
 * Himmelsfarbe und Sonnenstand kommen aus Uhrzeit sowie Auf- und Untergang,
 * die Wolkenmenge aus cloud_cover, der Niederschlag aus dem Wettercode.
 * Das Gelände richtet sich nach dem Ort: Großstädte bekommen eine Skyline,
 * Höhenlagen ein Gebirge, alles andere die Hügelkette. Die konkrete Silhouette
 * wird aus den Koordinaten abgeleitet – jeder Ort behält dadurch über
 * Neuladen hinweg dieselbe Form.
 */

/* Deterministischer Zufall (mulberry32), damit nichts bei jedem Rendern zappelt. */
const rngFrom = seed => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b)
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

/* Tagesabschnitte. "day" behält bewusst den Verlauf des bisherigen Bildes. */
const PHASES = {
  night: { sky: ['#0c1c2c', '#163449', '#274d63'], tint: '#122c3c', strength: .68, light: '#cfe3ef', glow: .22 },
  dawn:  { sky: ['#5b86ae', '#d7a882', '#f6dcb0'], tint: '#e6bd94', strength: .26, light: '#ffe6c0', glow: .50 },
  day:   { sky: ['#bbe9f7', '#d9edf1', '#f8eacb'], tint: '#f2ecd8', strength: .06, light: '#fff6d8', glow: .42 },
  dusk:  { sky: ['#4d7ba6', '#e0a274', '#f6cf95'], tint: '#d99a63', strength: .34, light: '#ffd79a', glow: .58 }
}

/* Grundtöne von fern nach nah. Der Dunst mischt sie später zum Himmel hin auf. */
const PALETTE = {
  hills: ['#b6cbc9', '#a4bfaa', '#8cae87', '#79a16d', '#659258'],
  alpine: ['#bcccd4', '#a3b6c1', '#8a9fae', '#74889a', '#5f7486'],
  /* Für die Stadt eine deutlich größere Helligkeitsspanne: vorher lagen ferne
     und nahe Ebene so dicht beieinander, dass keine Tiefe entstand. */
  city: ['#a8bdc9', '#8ba3b3', '#6b8497', '#4e6679', '#3d5265']
}

const phaseOf = (now, sunrise, sunset) => {
  const span = sunset - sunrise
  if (!(span > 0)) return 'day'
  const t = (now - sunrise) / span
  if (t < -0.08 || t > 1.08) return 'night'
  if (t < 0.1) return 'dawn'
  if (t > 0.9) return 'dusk'
  return 'day'
}

export const terrainOf = (population, elevation) =>
  population >= 150000 ? 'city' : elevation >= 1000 ? 'alpine' : 'hills'

/* ── Geländeformen ─────────────────────────────────────────────────────────── */

/** Weiche Hügelkette. */
const hillPath = (rng, baseY, amp, w, h) => {
  const points = 5
  const step = (w + 120) / points
  let x = -60
  let y = baseY + (rng() - .5) * amp
  let d = `M ${x} ${h} L ${x} ${y.toFixed(1)}`
  for (let i = 1; i <= points; i++) {
    const nx = -60 + i * step
    const ny = baseY + (rng() - .5) * amp
    const cx = (x + nx) / 2
    d += ` C ${cx.toFixed(1)} ${y.toFixed(1)}, ${cx.toFixed(1)} ${ny.toFixed(1)}, ${nx.toFixed(1)} ${ny.toFixed(1)}`
    x = nx; y = ny
  }
  return `${d} L ${(w + 60).toFixed(1)} ${h} Z`
}

/** Kantiger Gebirgszug mit spitzen Gipfeln. */
const ridgePath = (rng, baseY, amp, w, h, peaks) => {
  const step = (w + 120) / peaks
  let d = `M -60 ${h} L -60 ${baseY.toFixed(1)}`
  for (let i = 1; i <= peaks; i++) {
    const px = -60 + (i - .5) * step + (rng() - .5) * step * .3
    const py = baseY - amp * (.5 + rng() * .5)
    const vx = -60 + i * step
    const vy = baseY - amp * (rng() * .2)
    d += ` L ${px.toFixed(1)} ${py.toFixed(1)} L ${vx.toFixed(1)} ${vy.toFixed(1)}`
  }
  return `${d} L ${(w + 60).toFixed(1)} ${h} Z`
}

/**
 * Häuserzeile einer Ebene. Die Dachform entscheidet über den Umriss – ohne diese
 * Mischung liest sich eine Skyline wie ein Balkendiagramm.
 */
const BUILDING_KINDS = ['flat', 'flat', 'pitched', 'stepped', 'flat', 'pitched', 'tower', 'stepped']

const buildings = (rng, baseY, maxRise, w, depth) => {
  const unit = [26, 40, 56][depth]
  const rows = []
  let x = -40
  while (x < w + 40) {
    const bw = unit * (.55 + rng() * .95)
    const kind = depth === 0 ? 'flat' : BUILDING_KINDS[Math.floor(rng() * BUILDING_KINDS.length)]
    const tall = kind === 'tower'
    // Hoch-3 verteilt die Höhen so, dass nur wenige Häuser deutlich herausragen.
    const bh = maxRise * (tall ? .68 + rng() * .32 : .14 + rng() ** 3 * .6)
    rows.push({
      x, w: bw, h: bh, y: baseY - bh, kind,
      tank: kind === 'flat' && bh > maxRise * .3 && rng() > .7,
      lit: rng()
    })
    // Gelegentlich eine Lücke, damit Himmel zwischen den Blöcken durchkommt.
    x += bw + (rng() > .88 ? unit * .5 : depth === 0 ? 3 : 6)
  }
  return rows
}

export default function SkyScene({
  variant = 'wide', className, weatherCode = 0, cloudCover = 0,
  sunrise, sunset, latitude = 0, longitude = 0, now,
  population = 0, elevation = 0
}) {
  const wide = variant === 'wide'
  const W = wide ? 1200 : 900
  const H = wide ? 700 : 1300
  const horizon = H * (wide ? .58 : .56)

  const scene = useMemo(() => {
    const at = now ? new Date(now).getTime() : Date.now()
    const rise = new Date(sunrise).getTime()
    const set = new Date(sunset).getTime()
    const phase = phaseOf(at, rise, set)
    const p = PHASES[phase]
    const kind = weatherKind(weatherCode)
    const terrain = terrainOf(population, elevation)
    const isNight = phase === 'night'

    const seed = Math.round((latitude + 90) * 1000) * 7919 + Math.round((longitude + 180) * 1000)
    const rng = rngFrom(seed)

    // Sonne bzw. Mond auf einem Bogen zwischen Auf- und Untergang.
    const span = set - rise
    const dayT = span > 0 ? (at - rise) / span : .5
    const bodyT = isNight
      ? ((dayT < 0 ? dayT + 1 : dayT - 1) + 1) % 1
      : Math.min(1, Math.max(0, dayT))
    const bodyX = W * (.12 + bodyT * .76)
    const bodyY = horizon - Math.sin(Math.PI * bodyT) * horizon * .74

    const base = PALETTE[terrain]
    const depth = H - horizon
    const shade = i => mix(mix(base[i], '#5f7d78', i * .05), p.tint, p.strength * (1 - i * .1))

    let layers = []
    let city = null
    let caps = []

    if (terrain === 'alpine') {
      layers = [0, 1, 2, 3, 4].map(i => ({
        fill: shade(i),
        d: i < 3
          ? ridgePath(rng, horizon + i * depth * .16, depth * (.62 - i * .12), W, H, 3 + i)
          : hillPath(rng, horizon + i * depth * .17, depth * (.26 - (i - 3) * .05), W, H)
      }))
      // Schneekappen auf den beiden vordersten Graten.
      caps = [0, 1]
    } else {
      layers = [0, 1, 2, 3, 4].map(i => ({
        fill: shade(i),
        d: hillPath(rng, horizon + i * depth * .17, depth * (.3 - i * .04), W, H)
      }))

      /* Großstadt: dieselbe ruhige Hügelkette, dazu eine einzelne Gruppe
         weniger, dafür großer Gebäude. Sie wird vor die hinteren vier Hügel
         gezeichnet, aber hinter den vordersten – der verdeckt die Sockel, damit
         die Gruppe in der Landschaft steht statt darauf zu kleben. */
      if (terrain === 'city') {
        const baseY = horizon + depth * .78
        const count = 6 + Math.round(Math.min(4, Math.log10(population / 150000 + 1) * 4))
        // Mittleres Drittel: rechts oben steht im Dashboard die Begrüßung.
        const centre = W * (.38 + rng() * .24)
        const landmark = 1 + Math.floor(rng() * (count - 2))
        const tone = mix(shade(3), '#6d8496', .5)

        /* Erst Maße würfeln, dann die Gruppe um ihre Mitte setzen – sonst wächst
           sie einseitig aus dem Bild heraus. */
        const specs = Array.from({ length: count }, (_, i) => {
          const isLandmark = i === landmark
          return {
            isLandmark,
            w: W * (isLandmark ? .022 : .026 + rng() * .028),
            h: depth * (isLandmark ? 1.5 : .5 + rng() ** 1.4 * .78),
            gap: W * (.004 + rng() * .014),
            kind: isLandmark ? 'spire' : BUILDING_KINDS[Math.floor(rng() * BUILDING_KINDS.length)],
            tank: !isLandmark && rng() > .72
          }
        })
        const total = specs.reduce((sum, s) => sum + s.w + s.gap, 0) - specs.at(-1).gap
        // Mitte so begrenzen, dass die ganze Gruppe im Bild bleibt.
        const half = total / 2
        const cx = Math.min(Math.max(centre, half + W * .05), W - half - W * .05)

        const rows = []
        let x = cx - half
        for (const s of specs) {
          rows.push({ x, w: s.w, h: s.h, y: baseY - s.h, kind: s.kind, tank: s.tank })
          x += s.w + s.gap
        }

        city = {
          behind: 4,
          shadow: mix(tone, '#23333f', .24),
          rows: rows.map(b => {
            // Warmer Anflug auf der Sonnenseite erzeugt die Lichtrichtung.
            const warm = Math.max(0, 1 - Math.abs(b.x + b.w / 2 - bodyX) / (W * .5))
            return { ...b, fill: mix(tone, p.light, warm * .2) }
          })
        }
      }
    }

    const cloudCount = Math.round(cloudCover / 100 * 7)
    const clouds = Array.from({ length: cloudCount }, () => ({
      x: rng() * W,
      y: horizon * (.16 + rng() * .6),
      r: (60 + rng() * 110) * (wide ? 1 : .85),
      o: .3 + rng() * .42
    }))

    const wet = kind === 'rain' || kind === 'storm'
    const snowy = kind === 'snow'
    const drops = wet || snowy
      ? Array.from({ length: snowy ? 46 : 62 }, () => ({
          x: rng() * W, y: rng() * horizon * 1.12, l: 14 + rng() * 22,
          o: .18 + rng() * .4, d: rng() * 2
        }))
      : []

    const stars = isNight
      ? Array.from({ length: 54 }, () => ({ x: rng() * W, y: rng() * horizon * .82, r: .8 + rng() * 1.7, o: .25 + rng() * .6 }))
      : []

    const birds = !wet && !snowy && !isNight && cloudCover < 62
      ? Array.from({ length: 4 }, () => ({ x: W * (.5 + rng() * .42), y: horizon * (.22 + rng() * .3), s: 7 + rng() * 6 }))
      : []

    /* Erleuchtete Fenster nur abends und nachts. Sie sitzen im oberen Teil der
       Häuser – der untere verschwindet ohnehin hinter dem vordersten Hügel. */
    const windows = []
    if (city && (isNight || phase === 'dusk')) {
      for (const b of city.rows) {
        if (b.kind === 'spire') continue
        const usable = Math.min(b.h, depth * .8)
        const cols = Math.max(2, Math.floor(b.w / 13))
        const rowCount = Math.max(3, Math.floor(usable / 17))
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rowCount; cy++) {
            if (rng() > .38 || windows.length > 150) continue
            windows.push({
              x: b.x + 6 + cx * (b.w - 11) / cols,
              y: b.y + 12 + cy * (usable - 18) / rowCount,
              o: .4 + rng() * .5
            })
          }
        }
      }
    }

    return {
      phase, p, terrain, layers, city, caps, clouds, drops, stars, birds,
      windows, snowy, foggy: kind === 'fog', bodyX, bodyY, isNight
    }
  }, [weatherCode, cloudCover, sunrise, sunset, latitude, longitude, now, population, elevation, W, H, horizon, wide])

  const {
    p, terrain, layers, city, caps, clouds, drops, stars, birds,
    windows, snowy, foggy, bodyX, bodyY, isNight
  } = scene
  const uid = `${variant}-${terrain}`

  return (
    <svg
      className={`sky-scene is-${terrain}${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset=".55" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0" stopColor={p.light} stopOpacity={p.glow} />
          <stop offset="1" stopColor={p.light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`puff-${uid}`}>
          <stop offset="0" stopColor="#fff" stopOpacity=".92" />
          <stop offset=".62" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`haze-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[2]} stopOpacity="0" />
          <stop offset="1" stopColor={p.sky[2]} stopOpacity={isNight ? '.32' : '.66'} />
        </linearGradient>
        {caps.map(i => (
          <clipPath key={i} id={`cap-${uid}-${i}`}>
            <path d={layers[i].d} />
          </clipPath>
        ))}
      </defs>

      <rect width={W} height={H} fill={`url(#sky-${uid})`} />

      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#eef6ff" opacity={s.o} />)}

      {/* Sonne oder Mond mit Streulicht */}
      <circle cx={bodyX} cy={bodyY} r={wide ? 300 : 260} fill={`url(#glow-${uid})`} />
      <circle cx={bodyX} cy={bodyY} r={isNight ? 26 : 34} fill={isNight ? '#e8f1fa' : p.light} opacity={isNight ? .92 : .95} />

      {clouds.map((c, i) => (
        <ellipse key={i} cx={c.x} cy={c.y} rx={c.r} ry={c.r * .42} fill={`url(#puff-${uid})`} opacity={c.o} />
      ))}

      {birds.map((b, i) => (
        <path key={i} d={`M ${b.x} ${b.y} q ${b.s} ${-b.s * .6} ${b.s * 2} 0`}
          fill="none" stroke={isNight ? '#9fb4c4' : '#5c7a86'} strokeWidth="2" strokeLinecap="round" opacity=".5" />
      ))}

      {/* Dunstband am Horizont – gibt der Silhouette Tiefe */}
      <rect x="0" y={horizon - (H - horizon) * .5} width={W} height={(H - horizon) * .6} fill={`url(#haze-${uid})`} />

      {layers.slice(0, city ? city.behind : layers.length).map((l, i) => (
        <path key={i} d={l.d} fill={l.fill} />
      ))}

      {city && city.rows.map((b, i) => (
        <g key={i} fill={b.fill}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} />

          {/* Schattenseite gibt den Blöcken Volumen – eine Fläche pro Haus. */}
          {b.w > 14 && (
            <rect
              x={b.x + (b.x + b.w / 2 < bodyX ? 0 : b.w * .74)}
              y={b.y} width={b.w * .26} height={b.h}
              fill={city.shadow}
            />
          )}

          {b.kind === 'pitched' && (
            <path d={`M ${b.x - 1} ${b.y + 1} L ${b.x + b.w / 2} ${b.y - b.w * .42} L ${b.x + b.w + 1} ${b.y + 1} Z`} />
          )}
          {b.kind === 'stepped' && (
            <>
              <rect x={b.x + b.w * .14} y={b.y - 16} width={b.w * .72} height="17" />
              <rect x={b.x + b.w * .34} y={b.y - 28} width={b.w * .32} height="13" />
            </>
          )}
          {b.kind === 'tower' && (
            <>
              <rect x={b.x + b.w * .28} y={b.y - 13} width={b.w * .44} height="14" />
              <rect x={b.x + b.w / 2 - 1.4} y={b.y - 40} width="2.8" height="28" />
            </>
          )}
          {b.kind === 'spire' && (
            <>
              <path d={`M ${b.x} ${b.y + 2} L ${b.x + b.w / 2} ${b.y - b.w * 1.7} L ${b.x + b.w} ${b.y + 2} Z`} />
              <rect x={b.x + b.w / 2 - 1.2} y={b.y - b.w * 2.5} width="2.4" height={b.w * .85} />
            </>
          )}
          {b.tank && <rect x={b.x + b.w * .56} y={b.y - 10} width={b.w * .22} height="10" />}
        </g>
      ))}

      {/* Fenster gehören zu den Häusern, der vorderste Hügel liegt davor. */}
      {windows.length > 0 && (
        <g fill="#ffe6ad">
          {windows.map((w, i) => <rect key={i} x={w.x} y={w.y} width="3.2" height="4.6" opacity={w.o} />)}
        </g>
      )}

      {city && layers.slice(city.behind).map((l, i) => (
        <path key={i} d={l.d} fill={l.fill} />
      ))}

      {/* Schneekappen: weiße Fläche, auf die Gratform beschnitten */}
      {caps.map(i => (
        <rect
          key={i}
          clipPath={`url(#cap-${uid}-${i})`}
          x="0" y={0}
          width={W}
          height={horizon + (H - horizon) * (i * .16 + .1)}
          fill={isNight ? '#c9dae8' : '#f4f8fa'}
          opacity={isNight ? .28 : .72}
        />
      ))}

      {foggy && <rect x="0" y={horizon * .7} width={W} height={H} fill="#e8eef0" opacity=".42" />}

      {drops.length > 0 && (
        <g className={snowy ? 'scene-snow' : 'scene-rain'}>
          {drops.map((d, i) => snowy
            ? <circle key={i} cx={d.x} cy={d.y} r="2.6" fill="#fff" opacity={d.o} style={{ animationDelay: `${d.d}s` }} />
            : <line key={i} x1={d.x} y1={d.y} x2={d.x - 4} y2={d.y + d.l}
                stroke="#dbeaf2" strokeWidth="1.8" strokeLinecap="round" opacity={d.o}
                style={{ animationDelay: `${d.d}s` }} />
          )}
        </g>
      )}
    </svg>
  )
}
