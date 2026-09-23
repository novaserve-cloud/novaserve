# `nova dev`

Starts the local in-process development emulator with hot reloading.

## Usage

```bash
nova dev [options]
```

## Options

- `-p, --port <port>`: Port to listen on. Default: `3000`.
- `--env <environment>`: Target environment configuration to load. Default: `development`.

## Features

- In-process HTTP routing powered by Hono.
- Real-time watcher transpiling TypeScript handlers instantly via esbuild.
- Zero external cloud credentials required.
