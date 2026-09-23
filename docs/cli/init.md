# `nova init`

Creates a new NovaServe project with pre-configured scaffolding, TypeScript configuration, and sample handlers.

## Usage

```bash
nova init [name] [options]
```

## Options

- `-t, --template <template>`: Template to use (`basic-api`, `cron-worker`, `vite-react`, `nextjs`). Default: `basic-api`.
- `--runtime <runtime>`: Default runtime for compute functions. Default: `node20`.
- `--region <region>`: Default cloud region. Default: `us-east-1`.

## Examples

```bash
# Initialize a project named my-service
nova init my-service

# Initialize with specific template
nova init background-cron --template cron-worker
```
