// Kleine, vollständig lokale API-Antworten: keine Tests gegen das Live-Wetter.
export function weatherFixture({ date = '2026-10-27', hour = 12, timezone = 'Europe/Berlin', temperature = 18, pollen = 0 } = {}) {
  const dates = Array.from({ length: 10 }, (_, i) => new Date(Date.parse(`${date}T00:00Z`) + i * 86400000).toISOString().slice(0, 10))
  const time = dates.flatMap(day => Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`))
  const fill = value => time.map(() => value)
  const days = value => dates.map(() => value)
  return {
    timezone, elevation: 729,
    current: {
      time: `${date}T${String(hour).padStart(2, '0')}:30`, temperature_2m: temperature,
      apparent_temperature: temperature - 1, is_day: hour >= 7 && hour < 19 ? 1 : 0,
      weather_code: 0, cloud_cover: 10, pressure_msl: 1013, relative_humidity_2m: 60,
      wind_speed_10m: 10, wind_gusts_10m: 20, wind_direction_10m: 180
    },
    hourly: {
      time, temperature_2m: time.map((_, i) => i % 24), apparent_temperature: fill(15),
      weather_code: fill(0), precipitation_probability: fill(0), precipitation: fill(0),
      wind_speed_10m: fill(10), wind_gusts_10m: fill(20), uv_index: fill(2),
      relative_humidity_2m: fill(60), visibility: fill(20000), cloud_cover: fill(10),
      is_day: time.map((_, i) => i % 24 >= 7 && i % 24 < 19 ? 1 : 0)
    },
    daily: {
      time: dates, weather_code: days(0), temperature_2m_max: days(20), temperature_2m_min: days(8),
      apparent_temperature_max: days(19), apparent_temperature_min: days(7),
      sunrise: dates.map(day => `${day}T07:00`), sunset: dates.map(day => `${day}T18:00`),
      uv_index_max: days(3), precipitation_sum: days(0), precipitation_probability_max: days(0),
      precipitation_hours: days(0), wind_speed_10m_max: days(15), wind_gusts_10m_max: days(25),
      wind_direction_10m_dominant: days(180)
    },
    air: {
      current: { european_aqi: 25, pm2_5: 5, pm10: 10, alder_pollen: pollen, birch_pollen: pollen, grass_pollen: pollen },
      hourly: { time, european_aqi: time.map((_, i) => 10 + i % 24) }
    }
  }
}
