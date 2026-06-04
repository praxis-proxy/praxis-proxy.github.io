# Praxis Website

Source for [praxis.fast](https://praxis.fast), the project website for
[Praxis](https://github.com/praxis-proxy/praxis). Built with
[Docusaurus 3](https://docusaurus.io/).

## Development

```console
npm ci
npm start
```

Opens a local dev server with hot reload.

## Build

```console
npm run build
```

Generates static output in `build/`. The site is deployed automatically
via GitHub Actions on push to `main`.

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

MIT
