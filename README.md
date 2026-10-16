# Praxis Website

Source for the Praxis project website: [praxis.fast](https://praxis.fast).

## Development

Built with [Docusaurus 3](https://docusaurus.io/). Server can be started with:

```console
npm ci
npm start
```

Server is started with hot reload, make your changes and watch them update live.

## Build

```console
npm run build
```

Generates static output in `build/`.

The site is deployed automatically via GitHub Actions on push to `main`.

Pull requests run CI (typecheck + build) and publish a [Netlify](https://www.netlify.com/) Deploy Preview. Add these repository secrets:

- `NETLIFY_AUTH_TOKEN` — personal access token from Netlify user settings
- `NETLIFY_SITE_ID` — Site ID from the Netlify site’s Site configuration

## Structure

```
docs/           Documentation (markdown + Docusaurus sidebar metadata)
blog/           Blog posts
src/pages/      Custom pages (homepage, examples showcase)
src/data/       Structured data (example config catalog)
src/css/        Custom theme styles
static/         Static assets (favicon, CNAME)
```

## License

[Apache-2.0](LICENSE)
