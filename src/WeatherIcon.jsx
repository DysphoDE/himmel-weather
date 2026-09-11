import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudRain, CloudLightning, Snowflake } from 'lucide-react'
import { weatherKind } from './weather'

/** isDay wird aus der API übernommen – nachts ist ein Sonnensymbol schlicht falsch. */
export default function WeatherIcon({ code, size = 28, strokeWidth = 1.7, isDay = true, className }) {
  const props = { size, strokeWidth, className, 'aria-hidden': true }
  switch (weatherKind(code)) {
    case 'clear': return isDay ? <Sun {...props} /> : <Moon {...props} />
    case 'partly': return isDay ? <CloudSun {...props} /> : <CloudMoon {...props} />
    case 'rain': return <CloudRain {...props} />
    case 'storm': return <CloudLightning {...props} />
    case 'snow': return <Snowflake {...props} />
    case 'fog': return <CloudFog {...props} />
    default: return <Cloud {...props} />
  }
}
