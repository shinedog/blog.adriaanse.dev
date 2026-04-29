# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Install dependencies
yarn

# Start development server (runs Hugo + webpack-dev-server concurrently on port 3000)
yarn start

# Build for production (webpack then Hugo, output to dist/)
yarn build

# Lint JS source files
yarn lint

# Run end-to-end tests (requires dev server running on port 3000)
npx cypress run

# Build with draft/future posts included (deploy preview mode)
yarn build:preview
```

The Hugo binary is bundled in `bin/` — it does not need to be installed separately; `hugo-bin` in devDependencies handles it.

## Architecture

This is a **Victor Hugo** stack: Hugo (static site generator) + Webpack (asset pipeline), deployed to Netlify with Decap CMS for content editing.

### Two build systems that must stay in sync

**Webpack** (`src/`) compiles JS and SCSS, then writes `site/data/webpack.json` (asset manifest). Hugo reads that manifest via `{{ .Site.Data.webpack }}` in `site/layouts/_default/baseof.html` to inject hashed asset URLs. Both must run together during development (`yarn start` runs them in parallel).

**Hugo** (`site/`) renders templates using content from `site/content/` and data from `site/data/`. Output lands in `dist/` along with webpack assets.

### Two JS entry points

- `src/index.js` → main site bundle (imports `src/css/main.scss`, runs Netlify Identity redirect logic via `src/js/app.js`)
- `src/js/cms.js` → Decap CMS admin bundle (`decap-cms-app`, React 19, functional components); registers preview templates for each content collection, injects compiled site CSS into the CMS preview pane via `to-string-loader`

### Hugo layout conventions

- `site/layouts/_default/baseof.html` — base shell; all pages extend it via Hugo blocks (`header`, `main`, `footer`)
- `site/layouts/partials/` — composable partials mixed into page layouts; use Hugo's `dict` to pass structured data into partials rather than relying on page context
- Section-specific layouts live in `site/layouts/section/` and `site/layouts/post/`
- SVG icons in `site/static/img/icons/` are referenced via `<use xlink:href="#SVG-ID">` using the `svg.html` partial

### CSS

Custom fork of Tachyons (utility-first). Main entry: `src/css/main.scss`, which `@use`s individual Sass modules from `src/css/imports/`. Brand variables (colors, spacing) live in `src/css/imports/_variables.css`. The same compiled CSS is injected into the CMS preview pane via `to-string-loader` in `src/js/cms.js`.

### Content and CMS

Content is Markdown with YAML front matter in `site/content/`. The Decap CMS schema (`site/static/admin/config.yml`) defines which fields each collection exposes — changes to front matter fields must be reflected in both the CMS config and the Hugo templates that read them.

CMS preview templates in `src/js/cms-preview-templates/` are functional React components. They receive `entry` (an Immutable.js Map — use `.getIn()` to read fields), `widgetFor`, and `getAsset` as props. Do not import `immutable` directly; use `.getIn()` and `.toJS()` on the values returned from `entry`.

### Blog posts

Posts live in `site/content/post/` as Markdown with YAML front matter. Required fields: `title`, `date`, `description`. Use `draft: true` to keep a post out of the public build.

The blog is focused on **Nix, NixOS, and DevSecOps** for small-team managed IT. Tone is direct and practical — show real configuration, acknowledge real tradeoffs, avoid vendor marketing language.

When adding a new post:
- Filename should be kebab-case matching the title
- Date format: `2026-04-29T09:00:00.000Z`
- Keep `draft: true` until the post is ready to publish
- The published blog list is paginated by 4; the Cypress test checks `have.length.at.least(1)` on `/post`

### Testing

Cypress e2e tests in `cypress/e2e/basic.cy.js` run against `http://localhost:3000`. Tests assert page navigation and that at least one blog post exists. The `netlify-plugin-cypress` plugin runs these tests automatically during Netlify builds.

## Key conventions

- JS uses ES6 with Babel (`@babel/preset-env` + `@babel/preset-react`); 2-space indent, double quotes, semicolons required (see `.eslintrc.yml`)
- `no-console` is a warning (not error), so `console.log` is tolerated but flagged
- Production builds are triggered by `yarn build` (webpack first, Hugo second); order matters because Hugo needs the webpack manifest
- Draft and future-dated posts are excluded from `yarn build` but included in `yarn build:preview`
- CMS admin panel uses `decap-cms-app` (the maintained successor to `netlify-cms-app`) with React 19
