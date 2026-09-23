# Installation

NovaServe requires **Node.js >= 20.0.0** and npm, pnpm, or yarn.

## Global CLI Installation

Install the `nova` CLI globally:

```bash
# Using npm
npm install -g novaserve

# Using pnpm
pnpm add -g novaserve

# Using yarn
yarn global add novaserve
```

Verify the installation:

```bash
nova --version
```

## Running without Installation (`npx`)

You can scaffold projects directly without installing globally:

```bash
npx novaserve@latest init my-api
```

## System Verification (`nova doctor`)

Run the built-in system doctor to verify Node version, package configuration, and cloud credentials:

```bash
nova doctor
```
