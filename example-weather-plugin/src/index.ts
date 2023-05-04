import { OpenAPIRouter } from "@cloudflare/itty-router-openapi";
import { GetForecast } from "./forecast";

declare global {
  const PIRATE_WEATHER_API_KEY: string
}

export const router = OpenAPIRouter({
  schema: {
    info: {
      title: 'Weather API',
      description: 'A plugin that allows the user to get weather information',
      version: 'v0.0.1',
    },
  },
  docs_url: '/',
  aiPlugin: {
    name_for_human: 'Pirate Weather',
    name_for_model: 'pirate_weather',
    description_for_human: "Pirate Weather plugin for ChatGPT.",
    description_for_model: "Pirate Weather plugin for ChatGPT. You can query weather information using this plugin",
    contact_email: 'support@example.com',
    legal_info_url: 'http://www.example.com/legal',
    logo_url: 'https://workers.cloudflare.com/resources/logo/logo.svg',
  },
})

router.get('/forecast', GetForecast)

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }))

export default {
  fetch: router.handle
}
