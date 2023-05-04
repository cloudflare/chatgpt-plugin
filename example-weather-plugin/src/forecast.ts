import { ApiException, OpenAPIRoute, Query, ValidationError } from "@cloudflare/itty-router-openapi";

export class GetForecast extends OpenAPIRoute {
  static schema = {
    tags: ['Forecast'],
    summary: 'Get forecast by latitude and longitute query parameters',
    parameters: {
      latitude: Query(String, {
        description: 'The latitude to search for',
        default: '30.26'
      }),
      longitude: Query(String, {
        description: 'The longitude to search for',
        default: '-97.74'
      }),
    },
    responses: {
      '200': {
        schema: {
          latitude: 45.42,
          longitude: -74.30000000000001,
          timezone: "America/Toronto",
          offset: -4.0,
          currently: {
            time: 1654056000.0,
            summary: "clear-night",
            icon: "clear-night",
            precipIntensity: 0.004297839575262448,
            precipType: "none",
            temperature: 0.0,
            apparentTemperature: 0.0,
            dewPoint: 100626.40625,
            pressure: 0.0,
            windSpeed: 15.155382707144021,
            windBearing: 71.83404347077446,
            cloudCover: 0.0
          },
          hourly: {
            data: [
              {
                time: 1654056000.0,
                icon: "clear-night",
                summary: "clear-night",
                precipAccumulation: 0.0,
                precipType: "none",
                temperature: 15.225000000000023,
                apparentTemperature: 15.472222470944814,
                dewPoint: 7.600000000000023,
                pressure: 1006.2640625,
                windSpeed: 15.155382707144021,
                windBearing: 71.83404347077446,
                cloudCover: 0.0
              },
            ]
          },
          daily: {
            data: [
              {
                time: 1654056000.0,
                icon: "rain",
                summary: "rain",
                sunriseTime: 1654074748.0,
                sunsetTime: 1654130288.0,
                moonPhase: 0.06510658568536382,
                precipAccumulation: 0.726318359375,
                precipType: "rain",
                temperatureHigh: 16.350000000000023,
                temperatureHighTime: 1654102800.0,
                temperatureLow: 12.412500000000023,
                temperatureLowTime: 1654092000.0,
                apparentTemperatureHigh: 18.945154173378285,
                apparentTemperatureHighTime: 1654120800.0,
                apparentTemperatureLow: 12.736014638445567,
                apparentTemperatureLowTime: 13.018278210795586,
                dewPoint: 9.745833333333357,
                pressure: 1002.41076171875,
                windSpeed: 15.194513142232859,
                windBearing: 0.3026326497395833,
                cloudCover: 0.38462293016675536,
                temperatureMin: 12.412500000000023,
                temperatureMinTime: 1654092000.0,
                temperatureMax: 16.350000000000023,
                temperatureMaxTime: 1654102800.0,
                apparentTemperatureMin: 12.736014638445567,
                apparentTemperatureMinTime: 13.018278210795586,
                apparentTemperatureMax: 18.945154173378285,
                apparentTemperatureMaxTime: 1654120800.0
              }
            ]
          }
        },
      },
    },
  }

  async handle(request: Request, env, ctx, data: Record<string, any>) {
    const url = `https://api.pirateweather.net/forecast/${env.PIRATE_WEATHER_API_KEY}/${data.latitude},${data.longitude}`

    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare Workers ChatGPT Weather Plugin Example'
      }
    })

    if (!resp.ok) {
      return new Response(await resp.text(), { status: 400 })
    }

    return resp
  }
}
