import { ApiException, OpenAPIRoute, Query, ValidationError } from "@cloudflare/itty-router-openapi";
import { Ai } from '@cloudflare/ai';

export class GetSearch extends OpenAPIRoute {
  static schema = {
    tags: ['Search'],
    summary: 'Search repositories by a query parameter',
    parameters: {
      q: Query(String, {
        description: 'The query to search for',
        default: 'cloudflare workers'
      }),
    },
    responses: {
      '200': {
        schema: {
          repos: [
            {
              name: 'itty-router-openapi',
              description: 'OpenAPI 3 schema generator and validator for Cloudflare Workers',
              stars: '80',
              url: 'https://github.com/cloudflare/itty-router-openapi',
            }
          ]
        },
      },
    },
  }

  async handle(request: Request, env, ctx, data: Record<string, any>) {
    // Initiate the AI
    const ai = new Ai(env.AI)

    const url = `https://api.github.com/search/repositories?q=${data.q}`

    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RepoAI - Cloudflare Workers ChatGPT Plugin Example'
      }
    })

    if (!resp.ok) {
      return new Response(await resp.text(), { status: 400 })
    }

    const json = await resp.json()

    // @ts-ignore
    const repos = json.items.map((item: any) => ({
      name: item.name,
      description: item.description,
      stars: item.stargazers_count,
      url: item.html_url
    }))
    // generate a response with Cloudflare AI:

    // Run a model call
    const output = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
      prompt: `Explain the repositories: ${JSON.stringify(repos)}`
    })

    return {
      repos: repos,
      ai: output
    }
  }
}
