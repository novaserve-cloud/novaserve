# `nova build`

Bundles application compute functions using esbuild for deployment to cloud runtimes.

## Usage

```bash
nova build [options]
```

## Options

- `-e, --env <environment>`: Target environment. Default: `production`.
- `-o, --outdir <directory>`: Output directory for compiled bundle artifacts. Default: `.nova/dist`.
