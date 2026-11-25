import state, { emit } from './state.js';

export function getForecastUrl(provider, city, lat, lon) {
    const encodedCity = encodeURIComponent((city || '').trim());
    const key = String(provider || '').toLowerCase();
    if (key.includes('met') || key === 'metno') {
        return (lat != null && lon != null)
            ? `https://www.yr.no/en/forecast/daily-table/${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
            : `https://www.yr.no/en/search?q=${encodedCity}`;
    }
    if (key.includes('7timer')) {
        return (lat != null && lon != null)
            ? `https://www.7timer.info/index.php?product=civil&lon=${Number(lon).toFixed(4)}&lat=${Number(lat).toFixed(4)}`
            : `https://www.7timer.info/`;
    }
    if (key.includes('wttr')) {
        return encodedCity
            ? `https://wttr.in/${encodedCity}`
            : (lat != null && lon != null ? `https://wttr.in/${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}` : `https://wttr.in/`);
    }
    return (lat != null && lon != null)
        ? `https://www.ventusky.com/?p=${Number(lat).toFixed(4)};${Number(lon).toFixed(4)};10`
        : `https://yandex.ru/search/?text=${encodeURIComponent('погода ' + (city || '').trim())}`;
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
        if (res.ok) {
            const data = await res.json();
            return {
                lat: Number(data.latitude),
                lon: Number(data.longitude),
                city: data.city || ""
            };
        }
    } catch {}

    try {
        const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) {
            const data = await res.json();
            return {
                lat: Number(data.latitude),
                lon: Number(data.longitude),
                city: data.cityName || ""
            };
        }
    } catch {}

    return null;
}

export function parseMetNorwaySymbol(symbolCode) {
    if (!symbolCode) return { desc: 'Clear', icon: '☀️' };
    const code = String(symbolCode).toLowerCase();
    const isNight = code.includes('night');
    const isDay = !isNight;

    if (code.includes('thunder')) {
        if (code.includes('snow')) return { desc: 'Thundersnow', icon: '⛈️' };
        return { desc: 'Thunderstorm', icon: '⛈️' };
    }
    if (code.includes('heavysnow')) return { desc: 'Heavy snow', icon: '❄️' };
    if (code.includes('lightsnow')) return { desc: 'Light snow', icon: '🌨️' };
    if (code.includes('snow')) return { desc: 'Snow', icon: '❄️' };
    if (code.includes('sleet')) return { desc: 'Sleet', icon: '🌨️' };
    if (code.includes('heavyrain')) return { desc: 'Heavy rain', icon: '🌧️' };
    if (code.includes('lightrain')) return { desc: 'Light rain', icon: isDay ? '🌦️' : '🌧️' };
    if (code.includes('rain')) return { desc: 'Rain', icon: '🌧️' };
    if (code.includes('fog')) return { desc: 'Fog', icon: '🌁' };
    if (code.includes('cloudy')) return { desc: 'Cloudy', icon: '☁️' };
    if (code.includes('partlycloudy')) return { desc: 'Partly cloudy', icon: isDay ? '⛅' : '☁️' };
    if (code.includes('fair')) return { desc: 'Fair', icon: isDay ? '🌤️' : '🌙' };
    return { desc: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? '☀️' : '🌙' };
}

export async function fetchMetNorwayWeather(city, lat, lon, isFahrenheit, timeoutMs = 3500) {
    let resolvedLat = lat;
    let resolvedLon = lon;
    let resolvedCity = city;

    if (city && (resolvedLat == null || resolvedLon == null)) {
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(timeoutMs) });
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    resolvedLat = geoData.results[0].latitude;
                    resolvedLon = geoData.results[0].longitude;
                    resolvedCity = geoData.results[0].name;
                }
            }
        } catch {}
    }

    if (resolvedLat == null || resolvedLon == null) {
        throw new Error("Missing coordinates for MET Norway");
    }

    const latParam = Number(resolvedLat).toFixed(4);
    const lonParam = Number(resolvedLon).toFixed(4);
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latParam}&lon=${lonParam}`, {
        headers: { 'User-Agent': 'Nova-Perdanga/1.4 ya.zhdanov.r@proton.me' },
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw new Error(`MET Norway HTTP ${res.status}`);
    const data = await res.json();
    const series = data.properties?.timeseries;
    if (!series || series.length === 0) throw new Error("MET Norway empty timeseries");

    const currItem = series[0];
    const currDetails = currItem.data?.instant?.details;
    const currSymbol = currItem.data?.next_1_hours?.summary?.symbol_code || currItem.data?.next_6_hours?.summary?.symbol_code;
    const { desc, icon } = parseMetNorwaySymbol(currSymbol);

    let rawTemp = currDetails?.air_temperature ?? 0;
    if (isFahrenheit) rawTemp = (rawTemp * 9/5) + 32;

    return {
        temp: formatTemperature(rawTemp, isFahrenheit),
        desc,
        icon,
        city: resolvedCity,
        lat: resolvedLat,
        lon: resolvedLon
    };
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

export async function resolveCoordinates(city, lat, lon, timeoutMs = 3500) {
    let resolvedLat = lat;
    let resolvedLon = lon;
    let resolvedCity = city;

    if (city && (resolvedLat == null || resolvedLon == null)) {
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(timeoutMs) });
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    resolvedLat = geoData.results[0].latitude;
                    resolvedLon = geoData.results[0].longitude;
                    resolvedCity = geoData.results[0].name;
                }
            }
        } catch {}

        if (resolvedLat == null || resolvedLon == null) {
            try {
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, { signal: AbortSignal.timeout(timeoutMs) });
                if (nomRes.ok) {
                    const nomData = await nomRes.json();
                    if (Array.isArray(nomData) && nomData.length > 0) {
                        resolvedLat = Number(nomData[0].lat);
                        resolvedLon = Number(nomData[0].lon);
                        resolvedCity = nomData[0].name || city;
                    }
                }
            } catch {}
        }
    }

    return { lat: resolvedLat, lon: resolvedLon, city: resolvedCity };
}

export function parse7TimerWeather(weatherCode) {
    const code = String(weatherCode || '').toLowerCase();
    const isNight = code.endsWith('night');
    const isDay = !isNight;
    const base = code.replace(/(day|night)$/, '');

    switch (base) {
        case 'clear':
            return { desc: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? '☀️' : '🌙' };
        case 'pcloudy':
            return { desc: 'Partly cloudy', icon: isDay ? '⛅' : '☁️' };
        case 'mcloudy':
            return { desc: 'Mostly cloudy', icon: '☁️' };
        case 'cloudy':
            return { desc: 'Overcast', icon: '☁️' };
        case 'humid':
            return { desc: 'Foggy', icon: '🌁' };
        case 'lightrain':
            return { desc: 'Light rain', icon: isDay ? '🌦️' : '🌧️' };
        case 'oshower':
        case 'ishower':
            return { desc: 'Showers', icon: isDay ? '🌦️' : '🌧️' };
        case 'rain':
            return { desc: 'Rain', icon: '🌧️' };
        case 'lightsnow':
            return { desc: 'Light snow', icon: '🌨️' };
        case 'snow':
            return { desc: 'Snow', icon: '❄️' };
        case 'rainsnow':
            return { desc: 'Sleet', icon: '🌨️' };
        case 'ts':
        case 'tsrain':
            return { desc: 'Thunderstorm', icon: '⛈️' };
        default:
            return { desc: 'Cloudy', icon: '☁️' };
    }
}

export async function fetch7TimerWeather(city, lat, lon, isFahrenheit, timeoutMs = 4500) {
    const coords = await resolveCoordinates(city, lat, lon, timeoutMs);
    if (coords.lat == null || coords.lon == null) {
        throw new Error("Missing coordinates for 7Timer");
    }

    const url = `https://www.7timer.info/bin/civil.php?lon=${Number(coords.lon).toFixed(4)}&lat=${Number(coords.lat).toFixed(4)}&ac=0&unit=metric&output=json&tzshift=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`7Timer HTTP ${res.status}`);
    const data = await res.json();
    const series = data.dataseries;
    if (!Array.isArray(series) || series.length === 0) throw new Error("7Timer empty dataseries");

    const curr = series[0];
    let rawTemp = Number(curr.temp2m ?? 0);
    if (isFahrenheit) rawTemp = (rawTemp * 9 / 5) + 32;
    const { desc, icon } = parse7TimerWeather(curr.weather);

    return {
        temp: formatTemperature(rawTemp, isFahrenheit),
        desc,
        icon,
        city: coords.city,
        lat: coords.lat,
        lon: coords.lon
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

export async function fetchOpenMeteoDetailed(city, lat, lon, isFahrenheit, timeoutMs = 3500) {
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

    const tempUnit = isFahrenheit ? '&temperature_unit=fahrenheit' : '';
    const windUnit = isFahrenheit ? '&windspeed_unit=mph' : '&windspeed_unit=ms';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${resolvedLat}&longitude=${resolvedLon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6${tempUnit}${windUnit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();

    const curr = data.current_weather;
    if (!curr) throw new Error("Open-Meteo empty current_weather");

    const isDay = curr.is_day !== undefined ? Boolean(curr.is_day) : true;
    const cond = parseWeatherCondition(curr.weathercode, 'openmeteo', isDay);

    const hourlyList = [];
    const hourlyTimes = data.hourly?.time || [];
    const hourlyTemps = data.hourly?.temperature_2m || [];
    const hourlyCodes = data.hourly?.weathercode || [];
    const hourlyHumid = data.hourly?.relativehumidity_2m || [];

    const currHourPrefix = curr.time ? curr.time.slice(0, 13) : '';
    let startIdx = 0;
    if (currHourPrefix) {
        const foundIdx = hourlyTimes.findIndex(t => t.slice(0, 13) >= currHourPrefix);
        if (foundIdx !== -1) startIdx = foundIdx;
    }

    for (let i = startIdx; i < Math.min(startIdx + 24, hourlyTimes.length); i++) {
        const hourNum = parseInt(hourlyTimes[i].slice(11, 13), 10);
        const itemIsDay = hourNum >= 6 && hourNum < 22;
        const itemCond = parseWeatherCondition(hourlyCodes[i], 'openmeteo', itemIsDay);
        hourlyList.push({
            time: i === startIdx ? 'Now' : `${String(hourNum).padStart(2, '0')}:00`,
            temp: formatTemperature(hourlyTemps[i], isFahrenheit),
            icon: itemCond.icon,
            desc: itemCond.desc
        });
    }

    const dailyList = [];
    const dailyTimes = data.daily?.time || [];
    const dailyMax = data.daily?.temperature_2m_max || [];
    const dailyMin = data.daily?.temperature_2m_min || [];
    const dailyCodes = data.daily?.weathercode || [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < Math.min(5, dailyTimes.length); i++) {
        const dDate = new Date(`${dailyTimes[i]}T12:00:00`);
        const dayLabel = i === 0 ? 'Today' : dayNames[dDate.getDay()];
        const dCond = parseWeatherCondition(dailyCodes[i], 'openmeteo', true);
        dailyList.push({
            day: dayLabel,
            icon: dCond.icon,
            desc: dCond.desc,
            minTemp: formatTemperature(dailyMin[i], isFahrenheit),
            maxTemp: formatTemperature(dailyMax[i], isFahrenheit),
            minVal: Number(dailyMin[i]),
            maxVal: Number(dailyMax[i])
        });
    }

    const currentHumidityVal = hourlyHumid[startIdx] != null ? `${Math.round(hourlyHumid[startIdx])}%` : '--';
    const windSpeedSuffix = isFahrenheit ? ' mph' : ' m/s';
    const windSpeedVal = curr.windspeed != null ? `${Math.round(curr.windspeed)}${windSpeedSuffix}` : '--';
    const minDayTemp = dailyMin[0] != null ? formatTemperature(dailyMin[0], isFahrenheit) : '--';
    const maxDayTemp = dailyMax[0] != null ? formatTemperature(dailyMax[0], isFahrenheit) : '--';

    return {
        provider: 'Open-Meteo',
        city: resolvedCity || 'Local',
        lat: resolvedLat,
        lon: resolvedLon,
        current: {
            temp: formatTemperature(curr.temperature, isFahrenheit),
            desc: cond.desc,
            icon: cond.icon,
            wind: windSpeedVal,
            humidity: currentHumidityVal,
            minTemp: minDayTemp,
            maxTemp: maxDayTemp
        },
        hourly: hourlyList,
        daily: dailyList
    };
}

export async function fetchMetNorwayDetailed(city, lat, lon, isFahrenheit, timeoutMs = 4000) {
    let resolvedLat = lat;
    let resolvedLon = lon;
    let resolvedCity = city;

    if (city && (resolvedLat == null || resolvedLon == null)) {
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(timeoutMs) });
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    resolvedLat = geoData.results[0].latitude;
                    resolvedLon = geoData.results[0].longitude;
                    resolvedCity = geoData.results[0].name;
                }
            }
        } catch {}
    }

    if (resolvedLat == null || resolvedLon == null) {
        throw new Error("Missing coordinates for MET Norway");
    }

    const latParam = Number(resolvedLat).toFixed(4);
    const lonParam = Number(resolvedLon).toFixed(4);
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latParam}&lon=${lonParam}`, {
        headers: { 'User-Agent': 'Nova-Perdanga/1.4 ya.zhdanov.r@proton.me' },
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw new Error(`MET Norway HTTP ${res.status}`);
    const data = await res.json();
    const series = data.properties?.timeseries;
    if (!series || series.length === 0) throw new Error("MET Norway empty timeseries");

    const currItem = series[0];
    const currDetails = currItem.data?.instant?.details;
    const currSymbol = currItem.data?.next_1_hours?.summary?.symbol_code || currItem.data?.next_6_hours?.summary?.symbol_code;
    const currCond = parseMetNorwaySymbol(currSymbol);

    let rawCurrTemp = currDetails?.air_temperature ?? 0;
    if (isFahrenheit) rawCurrTemp = (rawCurrTemp * 9/5) + 32;

    const hourlyList = [];
    for (let i = 0; i < Math.min(24, series.length); i++) {
        const item = series[i];
        const itemDate = new Date(item.time);
        const itemDetails = item.data?.instant?.details;
        const sym = item.data?.next_1_hours?.summary?.symbol_code || item.data?.next_6_hours?.summary?.symbol_code;
        const itemCond = parseMetNorwaySymbol(sym);

        let t = itemDetails?.air_temperature ?? 0;
        if (isFahrenheit) t = (t * 9/5) + 32;

        hourlyList.push({
            time: i === 0 ? 'Now' : `${String(itemDate.getHours()).padStart(2, '0')}:00`,
            temp: formatTemperature(t, isFahrenheit),
            icon: itemCond.icon,
            desc: itemCond.desc
        });
    }

    const daysMap = new Map();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const item of series) {
        const itemDate = new Date(item.time);
        const dayKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
        let t = item.data?.instant?.details?.air_temperature;
        if (t == null) continue;
        if (isFahrenheit) t = (t * 9/5) + 32;

        const sym = item.data?.next_6_hours?.summary?.symbol_code || item.data?.next_1_hours?.summary?.symbol_code || item.data?.next_12_hours?.summary?.symbol_code;

        if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, { min: t, max: t, sym: sym || '' });
        } else {
            const entry = daysMap.get(dayKey);
            if (t < entry.min) entry.min = t;
            if (t > entry.max) entry.max = t;
            if (itemDate.getHours() >= 11 && itemDate.getHours() <= 15 && sym) {
                entry.sym = sym;
            } else if (!entry.sym && sym) {
                entry.sym = sym;
            }
        }
    }

    const dailyList = [];
    let dayIndex = 0;
    for (const [dayKey, entry] of daysMap.entries()) {
        if (dayIndex >= 5) break;
        const dDate = new Date(`${dayKey}T12:00:00`);
        const dayLabel = dayIndex === 0 ? 'Today' : dayNames[dDate.getDay()];
        const dCond = parseMetNorwaySymbol(entry.sym);
        dailyList.push({
            day: dayLabel,
            icon: dCond.icon,
            desc: dCond.desc,
            minTemp: formatTemperature(entry.min, isFahrenheit),
            maxTemp: formatTemperature(entry.max, isFahrenheit),
            minVal: Number(entry.min),
            maxVal: Number(entry.max)
        });
        dayIndex++;
    }

    const rawWind = currDetails?.wind_speed ?? 0;
    const windSpeedVal = isFahrenheit 
        ? `${Math.round(rawWind * 2.237)} mph`
        : `${Math.round(rawWind)} m/s`;
    const humidityVal = currDetails?.relative_humidity != null 
        ? `${Math.round(currDetails.relative_humidity)}%` 
        : '--';

    const todayEntry = dailyList[0];

    return {
        provider: 'MET Norway',
        city: resolvedCity || 'Local',
        lat: resolvedLat,
        lon: resolvedLon,
        current: {
            temp: formatTemperature(rawCurrTemp, isFahrenheit),
            desc: currCond.desc,
            icon: currCond.icon,
            wind: windSpeedVal,
            humidity: humidityVal,
            minTemp: todayEntry ? todayEntry.minTemp : '--',
            maxTemp: todayEntry ? todayEntry.maxTemp : '--'
        },
        hourly: hourlyList,
        daily: dailyList
    };
}

export async function fetchWttrDetailed(city, lat, lon, isFahrenheit, timeoutMs = 4500) {
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

    const area = data.nearest_area?.[0];
    const resolvedCity = city || area?.areaName?.[0]?.value || area?.region?.[0]?.value || 'Local';
    const resolvedLat = area?.latitude ? Number(area.latitude) : lat;
    const resolvedLon = area?.longitude ? Number(area.longitude) : lon;

    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 21;
    const cond = parseWeatherCondition(curr.weatherCode, 'wttr', isDay);
    const descText = curr.weatherDesc?.[0]?.value ? curr.weatherDesc[0].value.trim() : cond.desc;
    const rawTemp = isFahrenheit ? curr.temp_F : curr.temp_C;

    const hourlyList = [];
    const weatherDays = data.weather || [];
    for (const day of weatherDays) {
        const hourlyArr = day.hourly || [];
        for (const hItem of hourlyArr) {
            const hTime = parseInt(hItem.time, 10);
            const hourVal = Math.floor(hTime / 100);
            const hIsDay = hourVal >= 6 && hourVal < 21;
            const hCond = parseWeatherCondition(hItem.weatherCode, 'wttr', hIsDay);
            const hTemp = isFahrenheit ? hItem.tempF : hItem.tempC;
            hourlyList.push({
                time: hourlyList.length === 0 ? 'Now' : `${String(hourVal).padStart(2, '0')}:00`,
                temp: formatTemperature(hTemp, isFahrenheit),
                icon: hCond.icon,
                desc: hCond.desc
            });
            if (hourlyList.length >= 24) break;
        }
        if (hourlyList.length >= 24) break;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyList = [];
    for (let i = 0; i < weatherDays.length; i++) {
        const day = weatherDays[i];
        const dDate = new Date(`${day.date}T12:00:00`);
        const dayLabel = i === 0 ? 'Today' : dayNames[dDate.getDay()];
        const midHour = day.hourly?.[4] || day.hourly?.[0];
        const dCond = parseWeatherCondition(midHour?.weatherCode || 0, 'wttr', true);
        const minVal = isFahrenheit ? day.mintempF : day.mintempC;
        const maxVal = isFahrenheit ? day.maxtempF : day.maxtempC;
        dailyList.push({
            day: dayLabel,
            icon: dCond.icon,
            desc: dCond.desc,
            minTemp: formatTemperature(minVal, isFahrenheit),
            maxTemp: formatTemperature(maxVal, isFahrenheit),
            minVal: Number(minVal),
            maxVal: Number(maxVal)
        });
    }

    const windVal = isFahrenheit 
        ? `${curr.windspeedMiles || 0} mph` 
        : `${Math.round((curr.windspeedKmph || 0) / 3.6)} m/s`;

    return {
        provider: 'wttr.in',
        city: resolvedCity,
        lat: resolvedLat,
        lon: resolvedLon,
        current: {
            temp: formatTemperature(rawTemp, isFahrenheit),
            desc: descText,
            icon: cond.icon,
            wind: windVal,
            humidity: `${curr.humidity || '--'}%`,
            minTemp: dailyList[0] ? dailyList[0].minTemp : '--',
            maxTemp: dailyList[0] ? dailyList[0].maxTemp : '--'
        },
        hourly: hourlyList,
        daily: dailyList
    };
}

export async function fetch7TimerDetailed(city, lat, lon, isFahrenheit, timeoutMs = 5000) {
    const coords = await resolveCoordinates(city, lat, lon, timeoutMs);
    if (coords.lat == null || coords.lon == null) {
        throw new Error("Missing coordinates for 7Timer");
    }

    const latParam = Number(coords.lat).toFixed(4);
    const lonParam = Number(coords.lon).toFixed(4);
    const civilUrl = `https://www.7timer.info/bin/civil.php?lon=${lonParam}&lat=${latParam}&ac=0&unit=metric&output=json&tzshift=0`;
    const lightUrl = `https://www.7timer.info/bin/civillight.php?lon=${lonParam}&lat=${latParam}&ac=0&unit=metric&output=json&tzshift=0`;

    const [civilRes, lightRes] = await Promise.all([
        fetch(civilUrl, { signal: AbortSignal.timeout(timeoutMs) }),
        fetch(lightUrl, { signal: AbortSignal.timeout(timeoutMs) })
    ]);
    if (!civilRes.ok) throw new Error(`7Timer civil HTTP ${civilRes.status}`);

    const civilData = await civilRes.json();
    const series = civilData.dataseries;
    if (!Array.isArray(series) || series.length === 0) throw new Error("7Timer empty dataseries");

    const initStr = String(civilData.init || '');
    let initMs = Date.now();
    if (/^\d{10}$/.test(initStr)) {
        const y = Number(initStr.slice(0, 4));
        const m = Number(initStr.slice(4, 6)) - 1;
        const d = Number(initStr.slice(6, 8));
        const h = Number(initStr.slice(8, 10));
        initMs = Date.UTC(y, m, d, h, 0, 0);
    }

    const curr = series[0];
    let rawCurrTemp = Number(curr.temp2m ?? 0);
    if (isFahrenheit) rawCurrTemp = (rawCurrTemp * 9 / 5) + 32;
    const currCond = parse7TimerWeather(curr.weather);

    const beaufortMs = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 10, 6: 12, 7: 16, 8: 19 };
    const windLevel = Number(curr.wind10m?.speed ?? 1);
    const windMs = beaufortMs[windLevel] ?? Math.max(1, windLevel * 2);
    const windVal = isFahrenheit
        ? `${Math.round(windMs * 2.237)} mph`
        : `${windMs} m/s`;

    const rhRaw = curr.rh2m != null ? String(curr.rh2m).trim() : '--';
    const humidityVal = rhRaw === '--' ? '--' : (rhRaw.endsWith('%') ? rhRaw : `${rhRaw}%`);

    const hourlyList = [];
    for (let i = 0; i < Math.min(8, series.length); i++) {
        const item = series[i];
        const itemDate = new Date(initMs + Number(item.timepoint || 0) * 3600 * 1000);
        let t = Number(item.temp2m ?? 0);
        if (isFahrenheit) t = (t * 9 / 5) + 32;
        const itemCond = parse7TimerWeather(item.weather);
        hourlyList.push({
            time: i === 0 ? 'Now' : `${String(itemDate.getHours()).padStart(2, '0')}:00`,
            temp: formatTemperature(t, isFahrenheit),
            icon: itemCond.icon,
            desc: itemCond.desc
        });
    }

    const dailyList = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (lightRes.ok) {
        try {
            const lightData = await lightRes.json();
            const lightSeries = lightData.dataseries || [];
            for (let i = 0; i < Math.min(5, lightSeries.length); i++) {
                const day = lightSeries[i];
                const dStr = String(day.date || '');
                const formattedDate = dStr.length === 8 ? `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}` : '';
                const dDate = formattedDate ? new Date(`${formattedDate}T12:00:00`) : new Date(Date.now() + i * 86400000);
                const dayLabel = i === 0 ? 'Today' : dayNames[dDate.getDay()];
                const dCond = parse7TimerWeather(day.weather);
                let minVal = Number(day.temp2m?.min ?? 0);
                let maxVal = Number(day.temp2m?.max ?? 0);
                if (isFahrenheit) {
                    minVal = (minVal * 9 / 5) + 32;
                    maxVal = (maxVal * 9 / 5) + 32;
                }
                dailyList.push({
                    day: dayLabel,
                    icon: dCond.icon,
                    desc: dCond.desc,
                    minTemp: formatTemperature(minVal, isFahrenheit),
                    maxTemp: formatTemperature(maxVal, isFahrenheit),
                    minVal,
                    maxVal
                });
            }
        } catch {}
    }

    const todayEntry = dailyList[0];

    return {
        provider: '7Timer!',
        city: coords.city || 'Local',
        lat: coords.lat,
        lon: coords.lon,
        current: {
            temp: formatTemperature(rawCurrTemp, isFahrenheit),
            desc: currCond.desc,
            icon: currCond.icon,
            wind: windVal,
            humidity: humidityVal,
            minTemp: todayEntry ? todayEntry.minTemp : '--',
            maxTemp: todayEntry ? todayEntry.maxTemp : '--'
        },
        hourly: hourlyList,
        daily: dailyList
    };
}

export async function fetchDetailedForecast(city, lat, lon, isFahrenheit, preferredProvider = 'auto') {
    let resolvedLat = lat;
    let resolvedLon = lon;
    let resolvedCity = city;

    if (!resolvedCity && (resolvedLat == null || resolvedLon == null)) {
        const loc = await fetchIpLocation();
        if (loc) {
            resolvedLat = loc.lat;
            resolvedLon = loc.lon;
            resolvedCity = loc.city;
        }
    }

    const providerFetchers = {
        openmeteo: () => fetchOpenMeteoDetailed(resolvedCity, resolvedLat, resolvedLon, isFahrenheit),
        metno: () => fetchMetNorwayDetailed(resolvedCity, resolvedLat, resolvedLon, isFahrenheit),
        '7timer': () => fetch7TimerDetailed(resolvedCity, resolvedLat, resolvedLon, isFahrenheit),
        wttr: () => fetchWttrDetailed(resolvedCity, resolvedLat, resolvedLon, isFahrenheit)
    };

    const order = ['openmeteo', 'metno', '7timer', 'wttr'];
    if (preferredProvider && preferredProvider !== 'auto' && providerFetchers[preferredProvider]) {
        order.splice(order.indexOf(preferredProvider), 1);
        order.unshift(preferredProvider);
    }

    let lastErr;
    for (const key of order) {
        try {
            return await providerFetchers[key]();
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr || new Error('All weather providers failed');
}

export function renderWeatherCard(data, serviceUrl) {
    const card = document.getElementById('weather-card');
    if (!card || !data) return;

    const cityEl = document.getElementById('wc-city');
    const badgeEl = document.getElementById('wc-provider-badge');
    const extLink = document.getElementById('wc-external-link');
    const iconEl = document.getElementById('wc-current-icon');
    const tempEl = document.getElementById('wc-current-temp');
    const descEl = document.getElementById('wc-current-desc');
    const windEl = document.getElementById('wc-wind');
    const humEl = document.getElementById('wc-humidity');
    const rangeEl = document.getElementById('wc-range');
    const hourlyListEl = document.getElementById('wc-hourly-list');
    const dailyListEl = document.getElementById('wc-daily-list');

    if (cityEl) cityEl.textContent = data.city || 'Local';
    if (badgeEl) badgeEl.textContent = data.provider || 'Forecast';
    if (extLink && serviceUrl) extLink.href = serviceUrl;

    if (data.current) {
        if (iconEl) iconEl.textContent = data.current.icon || '☀️';
        if (tempEl) tempEl.textContent = data.current.temp || '--°';
        if (descEl) descEl.textContent = data.current.desc || '--';
        if (windEl) windEl.textContent = data.current.wind || '--';
        if (humEl) humEl.textContent = data.current.humidity || '--';
        if (rangeEl) rangeEl.textContent = `${data.current.minTemp} / ${data.current.maxTemp}`;
    }

    if (hourlyListEl && Array.isArray(data.hourly)) {
        hourlyListEl.innerHTML = data.hourly.map(item => `
            <div class="wc-hourly-item">
                <span class="wc-hourly-time">${item.time}</span>
                <span class="wc-hourly-icon">${item.icon}</span>
                <span class="wc-hourly-temp">${item.temp}</span>
            </div>
        `).join('');
    }

    if (dailyListEl && Array.isArray(data.daily)) {
        const numericMins = data.daily.map(d => d.minVal).filter(v => typeof v === 'number' && !isNaN(v));
        const numericMaxs = data.daily.map(d => d.maxVal).filter(v => typeof v === 'number' && !isNaN(v));
        const hasRange = numericMins.length > 0 && numericMaxs.length > 0;
        const globalMin = hasRange ? Math.min(...numericMins) : 0;
        const globalMax = hasRange ? Math.max(...numericMaxs) : 100;
        const span = Math.max(1, globalMax - globalMin);

        dailyListEl.innerHTML = data.daily.map(item => {
            let leftPct = 0;
            let widthPct = 100;
            if (hasRange && typeof item.minVal === 'number' && typeof item.maxVal === 'number') {
                leftPct = Math.max(0, Math.min(88, ((item.minVal - globalMin) / span) * 100));
                widthPct = Math.max(12, Math.min(100 - leftPct, ((item.maxVal - item.minVal) / span) * 100));
            }
            return `
                <div class="wc-daily-item">
                    <span class="wc-daily-name">${item.day}</span>
                    <span class="wc-daily-icon">${item.icon}</span>
                    <span class="wc-daily-desc">${item.desc}</span>
                    <div class="wc-daily-range">
                        <span class="wc-daily-min">${item.minTemp}</span>
                        <div class="wc-daily-bar-track">
                            <div class="wc-daily-bar-fill" style="left: ${leftPct.toFixed(1)}%; width: ${widthPct.toFixed(1)}%;"></div>
                        </div>
                        <span class="wc-daily-max">${item.maxTemp}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

let isCardLoading = false;
let weatherEventsInitialized = false;

export function closeWeatherCard() {
    const card = document.getElementById('weather-card');
    const backdrop = document.getElementById('weather-backdrop');
    if (card) {
        card.classList.remove('show');
        card.classList.add('hide');
    }
    if (backdrop) {
        backdrop.classList.add('hide');
    }
}

export async function openWeatherCard() {
    const card = document.getElementById('weather-card');
    const backdrop = document.getElementById('weather-backdrop');
    if (!card) return;

    if (backdrop) backdrop.classList.remove('hide');
    card.classList.remove('hide');
    card.classList.add('show');

    const settings = state.settings;
    const isFahrenheit = settings.weatherUnit === 'fahrenheit';
    const cityQuery = settings.weatherCity.trim();
    const provider = settings.weatherProvider || 'auto';

    const cacheRaw = localStorage.getItem('nova_detailed_weather_cache_v2');
    if (cacheRaw) {
        try {
            const cached = JSON.parse(cacheRaw);
            const isFresh = cached.timestamp && (Date.now() - cached.timestamp < 15 * 60 * 1000);
            const sameCity = (cached.cityQuery || '') === cityQuery;
            const sameUnit = cached.unit === settings.weatherUnit;
            const sameProvider = (cached.provider || 'auto') === provider;
            if (isFresh && sameCity && sameUnit && sameProvider && cached.data) {
                const serviceUrl = getForecastUrl(cached.data.provider || provider, cached.data.city, cached.data.lat, cached.data.lon);
                renderWeatherCard(cached.data, serviceUrl);
                return;
            }
        } catch {}
    }

    if (isCardLoading) return;
    isCardLoading = true;

    let knownLat = null;
    let knownLon = null;
    let knownCity = cityQuery;
    try {
        const wCache = JSON.parse(localStorage.getItem('nova_weather_cache') || 'null');
        if (wCache && (wCache.cityQuery || '') === cityQuery) {
            knownLat = wCache.lat ?? null;
            knownLon = wCache.lon ?? null;
            knownCity = knownCity || wCache.city || '';
        }
    } catch {}

    try {
        const data = await fetchDetailedForecast(knownCity, knownLat, knownLon, isFahrenheit, provider);
        const serviceUrl = getForecastUrl(data.provider || provider, data.city, data.lat, data.lon);
        renderWeatherCard(data, serviceUrl);

        localStorage.setItem('nova_detailed_weather_cache_v2', JSON.stringify({
            data,
            timestamp: Date.now(),
            cityQuery,
            unit: settings.weatherUnit,
            provider
        }));
    } catch {
        const descEl = document.getElementById('wc-current-desc');
        if (descEl) descEl.textContent = 'Forecast unavailable';
    } finally {
        isCardLoading = false;
    }
}

export function toggleWeatherCard() {
    const card = document.getElementById('weather-card');
    if (!card) return;
    if (card.classList.contains('show')) {
        closeWeatherCard();
    } else {
        openWeatherCard();
    }
}

export function initWeatherEvents() {
    if (weatherEventsInitialized) return;
    weatherEventsInitialized = true;

    const domWeather = document.getElementById('weather');
    const card = document.getElementById('weather-card');
    const backdrop = document.getElementById('weather-backdrop');
    const closeBtn = document.getElementById('wc-close-btn');
    const hourlyList = document.getElementById('wc-hourly-list');
    const providerBadge = document.getElementById('wc-provider-badge');

    if (domWeather) {
        domWeather.addEventListener('click', (e) => {
            e.preventDefault();
            toggleWeatherCard();
        });
    }

    if (providerBadge) {
        const providerCycle = ['auto', 'openmeteo', 'metno', '7timer', 'wttr'];
        providerBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = state.settings.weatherProvider || 'auto';
            const idx = providerCycle.indexOf(current);
            const nextProvider = providerCycle[(idx + 1) % providerCycle.length];
            emit('weather:setProvider', nextProvider);
            localStorage.removeItem('nova_detailed_weather_cache_v2');
            providerBadge.textContent = '...';
            openWeatherCard();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeWeatherCard();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeWeatherCard();
        });
    }

    if (hourlyList) {
        hourlyList.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                hourlyList.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }

    document.addEventListener('click', (e) => {
        if (!card || !card.classList.contains('show')) return;
        if (!card.contains(e.target) && !domWeather?.contains(e.target)) {
            closeWeatherCard();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && card && card.classList.contains('show')) {
            closeWeatherCard();
        }
    });
}

export async function updateWeather(force = false) {
    const settings = state.settings;
    const domWeather = document.getElementById('weather');
    const domWeatherTemp = document.getElementById('weather-temp');
    const domWeatherDesc = document.getElementById('weather-desc');
    const domWeatherIcon = document.getElementById('weather-icon');
    if (!domWeather || !domWeatherTemp || !domWeatherDesc || !domWeatherIcon) return;

    initWeatherEvents();

    if (!settings.weatherEnabled) {
        domWeather.classList.add('hidden');
        closeWeatherCard();
        return;
    }

    const provider = settings.weatherProvider || 'auto';
    const cacheRaw = localStorage.getItem('nova_weather_cache');
    if (!force && cacheRaw) {
        try {
            const cached = JSON.parse(cacheRaw);
            const isFresh = cached.timestamp && (Date.now() - cached.timestamp < 20 * 60 * 1000);
            const sameCity = (cached.cityQuery || '') === settings.weatherCity.trim();
            const sameUnit = cached.unit === settings.weatherUnit;
            const sameProvider = (cached.provider || 'auto') === provider;
            if (isFresh && sameCity && sameUnit && sameProvider) {
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

        const buildAutoTasks = () => {
            const tasks = [];
            if (initialCity || (initialLat != null && initialLon != null)) {
                tasks.push(fetchOpenMeteoWeather(initialCity, initialLat, initialLon, isFahrenheit));
                tasks.push(fetchMetNorwayWeather(initialCity, initialLat, initialLon, isFahrenheit));
                tasks.push(fetch7TimerWeather(initialCity, initialLat, initialLon, isFahrenheit));
            }
            tasks.push(fetchWttrWeather(initialCity, initialLat, initialLon, isFahrenheit));
            return tasks;
        };

        const providerFetchers = {
            openmeteo: () => fetchOpenMeteoWeather(initialCity, initialLat, initialLon, isFahrenheit),
            metno: () => fetchMetNorwayWeather(initialCity, initialLat, initialLon, isFahrenheit),
            '7timer': () => fetch7TimerWeather(initialCity, initialLat, initialLon, isFahrenheit),
            wttr: () => fetchWttrWeather(initialCity, initialLat, initialLon, isFahrenheit)
        };

        let weatherData;
        if (provider !== 'auto' && providerFetchers[provider]) {
            try {
                weatherData = await providerFetchers[provider]();
            } catch {
                weatherData = await Promise.any(buildAutoTasks());
            }
        } else {
            weatherData = await Promise.any(buildAutoTasks());
        }

        const displayCity = weatherData.city || initialCity || "Local";
        const serviceUrl = getForecastUrl(provider, displayCity, weatherData.lat, weatherData.lon);

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
            city: displayCity,
            lat: weatherData.lat,
            lon: weatherData.lon,
            timestamp: Date.now(),
            cityQuery,
            unit: settings.weatherUnit,
            provider
        }));
    } catch {
        if (!localStorage.getItem('nova_weather_cache')) {
            domWeatherDesc.textContent = "Weather offline";
            domWeatherIcon.textContent = "❌";
            domWeather.classList.remove('hidden');
        }
    }
}
