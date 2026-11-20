import state from './state.js';

export function getForecastUrl(service, city, lat, lon) {
    const encodedCity = encodeURIComponent((city || '').trim());
    switch (service) {
        case 'weathercom':
            return (lat && lon) 
                ? `https://weather.com/weather/today/l/${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
                : `https://weather.com/weather/today/l/${encodedCity}`;
        case 'yandex':
            return `https://yandex.ru/search/?text=${encodeURIComponent('погода ' + (city || '').trim())}`;
        case 'ventusky':
            return (lat && lon)
                ? `https://www.ventusky.com/?p=${Number(lat).toFixed(4)};${Number(lon).toFixed(4)};10`
                : `https://www.ventusky.com`;
        case 'google':
        case 'msn':
        default:
            return `https://www.google.com/search?q=${encodeURIComponent('weather ' + (city || '').trim())}`;
    }
}

export function parseWeatherCondition(code, provider = 'openmeteo', isDay = true) {
    const c = Number(code);
    let desc = "Clear";
    let icon = isDay ? "☀️" : "🌙";

    if (provider === 'wttr') {
        if (c === 113) {
            desc = isDay ? "Clear" : "Clear night";
            icon = isDay ? "☀️" : "🌙";
        } else if (c === 116) {
            desc = "Partly cloudy";
            icon = isDay ? "⛅" : "☁️";
        } else if (c === 119) {
            desc = "Cloudy";
            icon = "☁️";
        } else if (c === 122) {
            desc = "Overcast";
            icon = "☁️";
        } else if (c === 143) {
            desc = "Mist";
            icon = "🌁";
        } else if (c === 248 || c === 260) {
            desc = c === 260 ? "Freezing fog" : "Fog";
            icon = "🌁";
        } else if (c === 200 || c === 386 || c === 389) {
            desc = "Thunderstorm";
            icon = "⛈️";
        } else if (c === 392 || c === 395) {
            desc = "Thundersnow";
            icon = "⛈️";
        } else if (c === 227 || c === 230 || c === 329 || c === 332 || c === 335 || c === 338 || c === 371) {
            desc = c === 230 ? "Blizzard" : "Heavy snow";
            icon = "❄️";
        } else if (c === 179 || c === 323 || c === 326 || c === 368) {
            desc = "Light snow";
            icon = "🌨️";
        } else if (c === 182 || c === 311 || c === 314 || c === 317 || c === 320 || c === 350 || c === 362 || c === 365 || c === 374 || c === 377) {
            desc = "Sleet";
            icon = "🌨️";
        } else if (c === 176 || c === 263 || c === 266 || c === 293 || c === 353) {
            desc = "Light rain";
            icon = isDay ? "🌦️" : "🌧️";
        } else if (c === 185 || c === 281 || c === 284) {
            desc = "Freezing drizzle";
            icon = "🌧️";
        } else if (c === 296 || c === 299 || c === 302 || c === 305 || c === 308 || c === 356 || c === 359) {
            desc = (c === 308 || c === 359) ? "Heavy rain" : "Rain";
            icon = "🌧️";
        }
    } else {
        if (c === 0) {
            desc = isDay ? "Clear sky" : "Clear night";
            icon = isDay ? "☀️" : "🌙";
        } else if (c === 1) {
            desc = "Mainly clear";
            icon = isDay ? "🌤️" : "🌙";
        } else if (c === 2) {
            desc = "Partly cloudy";
            icon = isDay ? "⛅" : "☁️";
        } else if (c === 3) {
            desc = "Overcast";
            icon = "☁️";
        } else if (c === 45 || c === 48) {
            desc = c === 48 ? "Freezing fog" : "Fog";
            icon = "🌁";
        } else if (c === 51 || c === 53 || c === 55) {
            desc = c === 51 ? "Light drizzle" : "Drizzle";
            icon = isDay ? "🌦️" : "🌧️";
        } else if (c === 56 || c === 57) {
            desc = "Freezing drizzle";
            icon = "🌧️";
        } else if (c === 61) {
            desc = "Light rain";
            icon = isDay ? "🌦️" : "🌧️";
        } else if (c === 63) {
            desc = "Rain";
            icon = "🌧️";
        } else if (c === 65) {
            desc = "Heavy rain";
            icon = "🌧️";
        } else if (c === 66 || c === 67) {
            desc = "Freezing rain";
            icon = "🌧️";
        } else if (c === 71) {
            desc = "Light snow";
            icon = "🌨️";
        } else if (c === 73) {
            desc = "Snow";
            icon = "❄️";
        } else if (c === 75) {
            desc = "Heavy snow";
            icon = "❄️";
        } else if (c === 77) {
            desc = "Snow grains";
            icon = "🌨️";
        } else if (c === 80) {
            desc = "Light showers";
            icon = isDay ? "🌦️" : "🌧️";
        } else if (c === 81 || c === 82) {
            desc = c === 82 ? "Violent showers" : "Heavy showers";
            icon = "🌧️";
        } else if (c === 85) {
            desc = "Snow showers";
            icon = "🌨️";
        } else if (c === 86) {
            desc = "Heavy snow showers";
            icon = "❄️";
        } else if (c === 95) {
            desc = "Thunderstorm";
            icon = "⛈️";
        } else if (c === 96 || c === 99) {
            desc = c === 99 ? "Severe thunderstorm" : "Thunderstorm & hail";
            icon = "⛈️";
        }
    }
    return { desc, icon };
}

export function formatTemperature(val, isFahrenheit) {
    let rounded = Math.round(Number(val));
    if (Object.is(rounded, -0) || rounded === -0) rounded = 0;
    return `${rounded}${isFahrenheit ? '°F' : '°C'}`;
}

export async function fetchIpLocation(timeoutMs = 2500) {
    try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) throw new Error(`geojs HTTP ${res.status}`);
        const data = await res.json();
        return {
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            city: data.city || ""
        };
    } catch {
        return null;
    }
}

export async function fetchWttrWeather(city, lat, lon, isFahrenheit, timeoutMs = 4000) {
    let target = '';
    if (city) {
        target = encodeURIComponent(city);
    } else if (lat != null && lon != null) {
        target = `${lat},${lon}`;
    }
    const res = await fetch(`https://wttr.in/${target}?format=j1`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`wttr HTTP ${res.status}`);
    const data = await res.json();
    const curr = data.current_condition?.[0];
    if (!curr) throw new Error("wttr empty condition");
    const rawTemp = isFahrenheit ? curr.temp_F : curr.temp_C;
    const area = data.nearest_area?.[0];
    const resolvedCity = city || area?.areaName?.[0]?.value || area?.region?.[0]?.value || "";
    const resolvedLat = area?.latitude ? Number(area.latitude) : lat;
    const resolvedLon = area?.longitude ? Number(area.longitude) : lon;
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 21;
    const condition = parseWeatherCondition(curr.weatherCode, 'wttr', isDay);
    const descText = curr.weatherDesc?.[0]?.value ? curr.weatherDesc[0].value.trim() : condition.desc;
    return {
        temp: formatTemperature(rawTemp, isFahrenheit),
        desc: descText,
        icon: condition.icon,
        city: resolvedCity,
        lat: resolvedLat,
        lon: resolvedLon
    };
}

export async function fetchOpenMeteoWeather(city, lat, lon, isFahrenheit, timeoutMs = 3000) {
    let resolvedLat = lat;
    let resolvedLon = lon;
    let resolvedCity = city;

    if (city && (resolvedLat == null || resolvedLon == null)) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(timeoutMs) });
        if (!geoRes.ok) throw new Error(`geocoding HTTP ${geoRes.status}`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
            resolvedLat = geoData.results[0].latitude;
            resolvedLon = geoData.results[0].longitude;
            resolvedCity = geoData.results[0].name;
        } else {
            throw new Error("City not found");
        }
    }

    if (resolvedLat == null || resolvedLon == null) {
        throw new Error("Missing coordinates for Open-Meteo");
    }

    const unit = isFahrenheit ? '&temperature_unit=fahrenheit' : '';
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${resolvedLat}&longitude=${resolvedLon}&current_weather=true${unit}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();
    if (!data.current_weather) throw new Error("Open-Meteo empty current_weather");
    const isDay = data.current_weather.is_day !== undefined 
        ? Boolean(data.current_weather.is_day) 
        : (new Date().getHours() >= 6 && new Date().getHours() < 21);
    const { desc, icon } = parseWeatherCondition(data.current_weather.weathercode, 'openmeteo', isDay);
    return {
        temp: formatTemperature(data.current_weather.temperature, isFahrenheit),
        desc,
        icon,
        city: resolvedCity,
        lat: resolvedLat,
        lon: resolvedLon
    };
}

export async function updateWeather(force = false) {
    const settings = state.settings;
    const domWeather = document.getElementById('weather');
    const domWeatherTemp = document.getElementById('weather-temp');
    const domWeatherDesc = document.getElementById('weather-desc');
    const domWeatherIcon = document.getElementById('weather-icon');
    if (!domWeather || !domWeatherTemp || !domWeatherDesc || !domWeatherIcon) return;

    if (!settings.weatherEnabled) {
        domWeather.classList.add('hidden');
        return;
    }

    const cacheRaw = localStorage.getItem('nova_weather_cache');
    if (!force && cacheRaw) {
        try {
            const cached = JSON.parse(cacheRaw);
            const isFresh = cached.timestamp && (Date.now() - cached.timestamp < 20 * 60 * 1000);
            const sameCity = (cached.cityQuery || '') === settings.weatherCity.trim();
            const sameUnit = cached.unit === settings.weatherUnit;
            if (isFresh && sameCity && sameUnit) {
                if (cached.icon === '🌫️') cached.icon = '🌁';
                domWeatherTemp.textContent = cached.temp;
                domWeatherDesc.textContent = cached.desc;
                domWeatherIcon.textContent = cached.icon;
                if (cached.serviceUrl) domWeather.href = cached.serviceUrl;
                domWeather.classList.remove('hidden');
                return;
            }
        } catch {}
    }

    try {
        const isFahrenheit = settings.weatherUnit === 'fahrenheit';
        const cityQuery = settings.weatherCity.trim();

        let initialLat = null;
        let initialLon = null;
        let initialCity = cityQuery;

        if (!cityQuery) {
            const ipLocation = await fetchIpLocation();
            if (ipLocation) {
                initialLat = ipLocation.lat;
                initialLon = ipLocation.lon;
                initialCity = ipLocation.city;
            }
        }

        const weatherTasks = [];
        weatherTasks.push(fetchWttrWeather(initialCity, initialLat, initialLon, isFahrenheit));
        if (initialCity || (initialLat != null && initialLon != null)) {
            weatherTasks.push(fetchOpenMeteoWeather(initialCity, initialLat, initialLon, isFahrenheit));
        }

        const weatherData = await Promise.any(weatherTasks);
        const displayCity = weatherData.city || initialCity || "Local";
        const serviceUrl = getForecastUrl(settings.weatherService, displayCity, weatherData.lat, weatherData.lon);

        domWeatherTemp.textContent = weatherData.temp;
        domWeatherDesc.textContent = `${weatherData.desc}, ${displayCity}`;
        domWeatherIcon.textContent = weatherData.icon;
        domWeather.href = serviceUrl;
        domWeather.classList.remove('hidden');

        localStorage.setItem('nova_weather_cache', JSON.stringify({
            temp: weatherData.temp,
            desc: `${weatherData.desc}, ${displayCity}`,
            icon: weatherData.icon,
            serviceUrl,
            timestamp: Date.now(),
            cityQuery,
            unit: settings.weatherUnit
        }));
    } catch {
        if (!localStorage.getItem('nova_weather_cache')) {
            domWeatherDesc.textContent = "Weather offline";
            domWeatherIcon.textContent = "❌";
            domWeather.classList.remove('hidden');
        }
    }
}
