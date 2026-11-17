import state from './state.js';

let lastTimeStr = "";
let lastDateStr = "";
let lastGreetStr = "";
let clockInterval = null;

export function hydrateUI() {
    try {
        const timeEnabled = localStorage.getItem('nova_time_enabled') !== 'false';
        const dateEnabled = localStorage.getItem('nova_date_enabled') !== 'false';
        const weatherEnabled = localStorage.getItem('nova_weather_enabled') !== 'false';
        const greetingsEnabled = localStorage.getItem('nova_greetings_enabled') !== 'false';

        if (timeEnabled) {
            const domClock = document.getElementById('clock');
            if (domClock) {
                let opts = { hour: '2-digit', minute: '2-digit' };
                try {
                    const savedOpts = localStorage.getItem('nova_time_opts');
                    if (savedOpts) opts = JSON.parse(savedOpts);
                } catch (e) {}
                domClock.textContent = new Date().toLocaleTimeString([], opts);
            }
        }

        if (dateEnabled) {
            const domDate = document.getElementById('date');
            if (domDate) {
                domDate.textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            }
        }

        if (greetingsEnabled) {
            const domGreeting = document.getElementById('greeting');
            if (domGreeting) {
                const hour = new Date().getHours();
                let greetText = "Good evening";
                if (hour < 12) greetText = "Good morning";
                else if (hour < 18) greetText = "Good afternoon";
                domGreeting.textContent = greetText;
            }
        }

        if (weatherEnabled) {
            const domWeather = document.getElementById('weather');
            if (domWeather) {
                try {
                    const cachedWeather = localStorage.getItem('nova_weather_cache');
                    if (cachedWeather) {
                        const w = JSON.parse(cachedWeather);
                        document.getElementById('weather-temp').textContent = w.temp;
                        document.getElementById('weather-desc').textContent = w.desc;
                        document.getElementById('weather-icon').textContent = w.icon;
                        if (w.serviceUrl) domWeather.href = w.serviceUrl;
                    } else {
                        document.getElementById('weather-desc').textContent = "Loading weather...";
                    }
                } catch(e) {}
            }
        }
    } catch (e) {}
}

export function updateClockAndDate() {
    const domClock = document.getElementById('clock');
    const domClockBlock = document.getElementById('time');
    const domDate = document.getElementById('date');
    const domGreeting = document.getElementById('greeting');
    if (!domClock || !domClockBlock || !domDate || !domGreeting) return;

    const now = new Date();
    const settings = state.settings;
    
    if (settings.timeEnabled) {
        domClockBlock.classList.remove('hidden');
        const opts = { 
            hour: '2-digit', 
            minute: '2-digit',
            second: settings.timeSeconds ? '2-digit' : undefined,
            hour12: settings.time12h 
        };
        const timeStr = now.toLocaleTimeString([], opts);
        if (timeStr !== lastTimeStr) {
            domClock.textContent = timeStr;
            lastTimeStr = timeStr;
        }
    } else {
        domClockBlock.classList.add('hidden');
    }

    if (settings.dateEnabled) {
        domDate.classList.remove('hidden');
        const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        if (dateStr !== lastDateStr) {
            domDate.textContent = dateStr;
            lastDateStr = dateStr;
        }
    } else {
        domDate.classList.add('hidden');
    }

    if (settings.greetingsEnabled) {
        domGreeting.classList.remove('hidden');
        const hour = now.getHours();
        let greetText = "Good evening";
        if (hour < 12) greetText = "Good morning";
        else if (hour < 18) greetText = "Good afternoon";
        
        if (greetText !== lastGreetStr) {
            domGreeting.textContent = greetText;
            lastGreetStr = greetText;
        }
    } else {
        domGreeting.classList.add('hidden');
    }
}

export function initClock() {
    updateClockAndDate();
    if (!clockInterval) {
        clockInterval = setInterval(updateClockAndDate, 200);
    }
}
