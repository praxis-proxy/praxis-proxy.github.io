# Praxis Website

Source for [praxis.fast](https://praxis.fast), the project website for
[Praxis](https://github.com/praxis-proxy/praxis) and
[praxis-ai](https://github.com/praxis-proxy/ai).

## Documentation sync

Source of truth for user docs:

- Core proxy: `praxis/docs/`
- AI gateway: `ai/docs/`
- Generated filter reference: `cargo xtask generate-filter-docs` in each repo

Port content to this site on release (or when docs change materially).
Run `npm run build` before merging — `onBrokenLinks: 'throw'` fails the
build on broken internal links.

The examples catalog (`src/data/examples.ts`) should stay aligned with
`praxis/examples/README.md` and `ai/examples/README.md`. Check locally:

```console
PRAXIS_EXAMPLES_README=../praxis/examples/README.md \
AI_EXAMPLES_README=../ai/examples/README.md \
bash scripts/lint-examples-catalog.sh
```

CI runs the same check against the upstream `praxis` and `ai` repos.

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
