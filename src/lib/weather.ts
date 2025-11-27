/**
 * Weather Service Module
 * Integrates with OpenWeatherMap API for precipitation and weather data
 */

// Weather condition categories
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'heavy_rain' | 'storm' | 'drizzle' | 'snow' | 'fog' | 'unknown';

// Precipitation intensity levels
export type PrecipitationLevel = 'none' | 'light' | 'moderate' | 'heavy';

// Current weather data structure
export interface CurrentWeather {
    condition: WeatherCondition;
    conditionCode: number;
    description: string;
    temperature: number;        // Celsius
    feelsLike: number;          // Celsius
    humidity: number;           // Percentage
    precipitation: PrecipitationLevel;
    precipitationMm: number;    // mm in last hour
    windSpeed: number;          // m/s
    cloudCover: number;         // Percentage
    visibility: number;         // meters
    icon: string;               // OpenWeatherMap icon code
    timestamp: Date;
    location: {
        city: string;
        country: string;
        lat: number;
        lon: number;
    };
}

// Weather record for database storage
export interface WeatherRecord {
    id?: number;
    date: string;               // YYYY-MM-DD format
    condition: WeatherCondition;
    avgTemperature: number;
    minTemperature: number;
    maxTemperature: number;
    totalPrecipitationMm: number;
    precipitationLevel: PrecipitationLevel;
    avgHumidity: number;
    avgCloudCover: number;
    description: string;
    location: string;           // City name
    createdAt: Date;
}

// Weather impact analysis
export interface WeatherImpact {
    precipitationLevel: PrecipitationLevel;
    isRainyDay: boolean;
    expectedTrafficChange: number;    // Percentage change (-15 = 15% less traffic)
    affectedCategories: string[];     // Product categories likely affected
    recommendations: string[];
}

// API response types (internal)
interface OpenWeatherResponse {
    weather: Array<{
        id: number;
        main: string;
        description: string;
        icon: string;
    }>;
    main: {
        temp: number;
        feels_like: number;
        humidity: number;
        temp_min: number;
        temp_max: number;
    };
    visibility: number;
    wind: {
        speed: number;
    };
    clouds: {
        all: number;
    };
    rain?: {
        '1h'?: number;
        '3h'?: number;
    };
    snow?: {
        '1h'?: number;
        '3h'?: number;
    };
    name: string;
    sys: {
        country: string;
    };
    coord: {
        lat: number;
        lon: number;
    };
    dt: number;
}

/**
 * Map OpenWeatherMap condition codes to our simplified categories
 */
function mapConditionCode(code: number): WeatherCondition {
    // OpenWeatherMap condition codes: https://openweathermap.org/weather-conditions
    if (code >= 200 && code < 300) return 'storm';        // Thunderstorm
    if (code >= 300 && code < 400) return 'drizzle';      // Drizzle
    if (code >= 500 && code < 505) return 'rain';         // Rain
    if (code >= 505 && code < 600) return 'heavy_rain';   // Extreme rain
    if (code >= 600 && code < 700) return 'snow';         // Snow
    if (code >= 700 && code < 800) return 'fog';          // Atmosphere (mist, fog, etc.)
    if (code === 800) return 'clear';                      // Clear
    if (code > 800 && code < 900) return 'cloudy';        // Clouds
    return 'unknown';
}

/**
 * Determine precipitation level from mm/hour
 */
function getPrecipitationLevel(mmPerHour: number): PrecipitationLevel {
    if (mmPerHour <= 0) return 'none';
    if (mmPerHour < 2.5) return 'light';
    if (mmPerHour < 7.5) return 'moderate';
    return 'heavy';
}

/**
 * Fetch current weather from OpenWeatherMap
 */
export async function fetchCurrentWeather(
    lat: number,
    lon: number,
    apiKey: string
): Promise<CurrentWeather | null> {
    if (!apiKey) {
        console.warn('Weather API key not configured');
        return null;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data: OpenWeatherResponse = await response.json();
        
        const condition = mapConditionCode(data.weather[0]?.id || 0);
        const precipMm = data.rain?.['1h'] || data.rain?.['3h'] || data.snow?.['1h'] || 0;

        return {
            condition,
            conditionCode: data.weather[0]?.id || 0,
            description: data.weather[0]?.description || 'Unknown',
            temperature: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            precipitation: getPrecipitationLevel(precipMm),
            precipitationMm: precipMm,
            windSpeed: data.wind.speed,
            cloudCover: data.clouds.all,
            visibility: data.visibility,
            icon: data.weather[0]?.icon || '01d',
            timestamp: new Date(data.dt * 1000),
            location: {
                city: data.name,
                country: data.sys.country,
                lat: data.coord.lat,
                lon: data.coord.lon
            }
        };
    } catch (error) {
        console.error('Error fetching weather:', error);
        return null;
    }
}

/**
 * Fetch weather by city name
 */
export async function fetchWeatherByCity(
    city: string,
    apiKey: string
): Promise<CurrentWeather | null> {
    if (!apiKey) {
        console.warn('Weather API key not configured');
        return null;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key');
            }
            if (response.status === 404) {
                throw new Error('City not found');
            }
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data: OpenWeatherResponse = await response.json();
        
        const condition = mapConditionCode(data.weather[0]?.id || 0);
        const precipMm = data.rain?.['1h'] || data.rain?.['3h'] || data.snow?.['1h'] || 0;

        return {
            condition,
            conditionCode: data.weather[0]?.id || 0,
            description: data.weather[0]?.description || 'Unknown',
            temperature: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            precipitation: getPrecipitationLevel(precipMm),
            precipitationMm: precipMm,
            windSpeed: data.wind.speed,
            cloudCover: data.clouds.all,
            visibility: data.visibility,
            icon: data.weather[0]?.icon || '01d',
            timestamp: new Date(data.dt * 1000),
            location: {
                city: data.name,
                country: data.sys.country,
                lat: data.coord.lat,
                lon: data.coord.lon
            }
        };
    } catch (error) {
        console.error('Error fetching weather by city:', error);
        return null;
    }
}

/**
 * Test weather API connection
 */
export async function testWeatherConnection(
    city: string,
    apiKey: string
): Promise<{ success: boolean; message: string; data?: CurrentWeather }> {
    try {
        const weather = await fetchWeatherByCity(city, apiKey);
        
        if (weather) {
            return {
                success: true,
                message: `Connected! Current weather in ${weather.location.city}: ${weather.description}, ${weather.temperature}°C`,
                data: weather
            };
        }
        
        return {
            success: false,
            message: 'Failed to fetch weather data'
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Get weather icon URL
 */
export function getWeatherIconUrl(iconCode: string): string {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

/**
 * Analyze weather impact on business
 */
export function analyzeWeatherImpact(weather: CurrentWeather): WeatherImpact {
    const isRainyDay = ['rain', 'heavy_rain', 'storm', 'drizzle'].includes(weather.condition);
    
    let expectedTrafficChange = 0;
    const affectedCategories: string[] = [];
    const recommendations: string[] = [];

    // Calculate expected traffic change based on conditions
    switch (weather.precipitation) {
        case 'light':
            expectedTrafficChange = -10;
            break;
        case 'moderate':
            expectedTrafficChange = -20;
            break;
        case 'heavy':
            expectedTrafficChange = -35;
            break;
        default:
            expectedTrafficChange = 0;
    }

    // Storm has additional impact
    if (weather.condition === 'storm') {
        expectedTrafficChange = Math.min(expectedTrafficChange - 15, -50);
    }

    // Determine affected product categories
    if (isRainyDay) {
        affectedCategories.push('beverages', 'snacks', 'impulse_items');
        recommendations.push('Rainy weather may reduce foot traffic');
        recommendations.push('Stock comfort foods and hot beverages if available');
        
        if (weather.precipitation === 'heavy' || weather.condition === 'storm') {
            affectedCategories.push('outdoor_items');
            recommendations.push('Consider delaying non-essential stock deliveries');
        }
    }

    // Temperature-based recommendations (for future expansion)
    if (weather.temperature > 30) {
        affectedCategories.push('cold_beverages', 'ice_cream');
        recommendations.push('High temperature - ensure cold beverages are well-stocked');
    } else if (weather.temperature < 15) {
        affectedCategories.push('hot_beverages', 'comfort_food');
    }

    return {
        precipitationLevel: weather.precipitation,
        isRainyDay,
        expectedTrafficChange,
        affectedCategories,
        recommendations
    };
}

/**
 * Get weather condition display info
 */
export function getWeatherConditionInfo(condition: WeatherCondition): {
    label: string;
    emoji: string;
    color: string;
} {
    switch (condition) {
        case 'clear':
            return { label: 'Clear', emoji: '☀️', color: 'text-yellow-500' };
        case 'cloudy':
            return { label: 'Cloudy', emoji: '☁️', color: 'text-gray-500' };
        case 'drizzle':
            return { label: 'Drizzle', emoji: '🌧️', color: 'text-blue-400' };
        case 'rain':
            return { label: 'Rain', emoji: '🌧️', color: 'text-blue-500' };
        case 'heavy_rain':
            return { label: 'Heavy Rain', emoji: '⛈️', color: 'text-blue-700' };
        case 'storm':
            return { label: 'Storm', emoji: '⛈️', color: 'text-purple-600' };
        case 'snow':
            return { label: 'Snow', emoji: '❄️', color: 'text-cyan-400' };
        case 'fog':
            return { label: 'Fog', emoji: '🌫️', color: 'text-gray-400' };
        default:
            return { label: 'Unknown', emoji: '❓', color: 'text-gray-500' };
    }
}

/**
 * Get precipitation level display info
 */
export function getPrecipitationInfo(level: PrecipitationLevel): {
    label: string;
    color: string;
    bgColor: string;
} {
    switch (level) {
        case 'none':
            return { label: 'None', color: 'text-green-600', bgColor: 'bg-green-100' };
        case 'light':
            return { label: 'Light', color: 'text-blue-500', bgColor: 'bg-blue-100' };
        case 'moderate':
            return { label: 'Moderate', color: 'text-blue-600', bgColor: 'bg-blue-200' };
        case 'heavy':
            return { label: 'Heavy', color: 'text-blue-800', bgColor: 'bg-blue-300' };
    }
}

/**
 * Create a weather record for database storage from current weather
 */
export function createWeatherRecord(weather: CurrentWeather): Omit<WeatherRecord, 'id'> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    return {
        date: dateStr,
        condition: weather.condition,
        avgTemperature: weather.temperature,
        minTemperature: weather.temperature, // Will be updated throughout the day
        maxTemperature: weather.temperature, // Will be updated throughout the day
        totalPrecipitationMm: weather.precipitationMm,
        precipitationLevel: weather.precipitation,
        avgHumidity: weather.humidity,
        avgCloudCover: weather.cloudCover,
        description: weather.description,
        location: weather.location.city,
        createdAt: new Date()
    };
}

