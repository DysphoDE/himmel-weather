/* Runde Punktmarke für gestreckte Diagramme. In einem SVG mit
   preserveAspectRatio="none" wird ein <circle> zur Ellipse verzerrt.
   Ein non-scaling-stroke mit runder Kappe wird dagegen erst nach dem
   Strecken in Bildschirm-Pixeln gezeichnet und bleibt deshalb rund;
   size ist entsprechend der Durchmesser in Pixeln. */
export default function ChartDot({ x, y, size = 7, ring = 'var(--rain)', core = '#fff' }) {
  const shared = { d: `M ${x} ${y} h .01`, fill: 'none', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }
  return (
    <g>
      <path {...shared} stroke={ring} strokeWidth={size} />
      <path {...shared} stroke={core} strokeWidth={size / 2} />
    </g>
  )
}
