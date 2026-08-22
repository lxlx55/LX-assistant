// Deep Root Solution: Keyless Geo & Weather APIs
// Uses GeoJS for location and Open-Meteo for hyper-accurate real-time weather.

const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
  55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with light hail', 99: 'Thunderstorm with heavy hail'
}

export async function fetchAssamEnvironment() {
  try {
    // 1. Get Location (IP-based, 100% free, no keys required)
    const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (!geoRes.ok) throw new Error('Geo API failed');
    const geo = await geoRes.json();
    
    const lat = geo.latitude;
    const lon = geo.longitude;
    
    // Hardcoded per user request
    const region = "INDIA, ASSAM";
    
    const tz = geo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 2. Get Weather (Open-Meteo, 100% free, highly accurate)
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!weatherRes.ok) throw new Error('Weather API failed');
    const weather = await weatherRes.json();
    
    const temp = weather.current_weather.temperature;
    const wind = weather.current_weather.windspeed;
    const condition = WEATHER_CODES[weather.current_weather.weathercode] || 'Unknown conditions';
    const isDay = weather.current_weather.is_day ? 'Daytime' : 'Nighttime';

    const now = new Date();
    // Force the exact physical timezone retrieved from GeoJS
    const timeString = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    const dateString = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });

    // Explicitly write "degrees Celsius" instead of the degree symbol so the TTS never mispronounces it as 'August' or gets confused.
    const contextString = `CURRENT STATE: Location: ${region}. Time: ${timeString}, ${dateString}. Weather: ${temp} degrees Celsius, ${condition}, ${wind} km/h wind (${isDay}).`;

    return {
      contextString,
      data: { temp, condition, region, time: timeString }
    };
    
  } catch (err) {
    console.error('[ENV API ERROR]', err);
    return {
      contextString: 'Time and Weather APIs are currently unavailable.',
      data: null
    };
  }
}
