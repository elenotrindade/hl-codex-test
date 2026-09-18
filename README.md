# Yard / Train Graffiti

Yard / Train Graffiti is a browser-based street painting workshop built with Vite and TypeScript. It lets visitors paint train and street surfaces, tune brush color and texture, save work in local browser storage, and view a mock gallery feed that stays on the current device.

## Prerequisites

- Node.js 22 or a compatible current Node.js release for Vite 7.
- npm, included with Node.js.

## Install Dependencies

Install the project dependencies from the repository root:

```bash
npm install
```

## Run Locally

Start the Vite development server:

```bash
npm run dev
```

Vite prints the local URL in the terminal. Open that URL in a browser to use the painting workshop.

## Scripts and Verification Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies for local development. |
| `npm run dev` | Start the Vite development server. |
| `npm test -- --run` | Run the full Vitest suite once. |
| `npm run build` | Type-check and build production assets. |
| `npm run preview` | Preview the production build locally. |

## Project Structure

```text
hl-codex-test/
├── README.md             # app overview, setup, scripts, testing, build, structure
├── index.html            # Vite HTML entry, loads /src/main.ts
├── package.json          # npm scripts and development dependencies
├── package-lock.json     # locked npm dependency graph
├── tsconfig.json         # TypeScript compiler options
├── vite.config.ts        # Vite and Vitest configuration
├── src/                  # browser app source code
└── tests/                # Vitest test files
```

## Testing and Build Workflow

Run the automated test suite once before opening a pull request or sharing changes:

```bash
npm test -- --run
```

Vitest runs in the Node environment and discovers tests from `tests/**/*.test.ts`.

Check the production build with:

```bash
npm run build
```

The build script runs TypeScript with `tsc --noEmit`, then produces production assets with Vite. To inspect the built app locally after a successful build, run:

```bash
npm run preview
```
