<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/logo.svg" height="40" alt="NovaServe Logo" />
</p>

# novaserve-runtime

> Universal handler wrapper, context injection, and OpenTelemetry span tracer for **NovaServe**.

`novaserve-runtime` normalizes incoming events across cloud providers (AWS Lambda, Cloudflare Workers, Hono local emulator) into standardized request context objects.

## Installation

```bash
npm install novaserve-runtime
# or
pnpm add novaserve-runtime
```

## Features

- **Universal Context**: Standardized `NovaContext` injection for HTTP, SQS, S3, and Cron event handlers.
- **OpenTelemetry Tracing**: Automatic span waterfall tracing and correlation ID propagation.
- **Response Utilities**: Helper functions for JSON responses, CORS headers, and error handling.

## Documentation & Repository

- **Main Repository**: [https://github.com/sazamansari/NovaServe-](https://github.com/sazamansari/NovaServe-)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

MIT © Md Shadab Azam Ansari & NovaServe Contributors
