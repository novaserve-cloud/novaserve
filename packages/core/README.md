<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/logo.svg" height="40" alt="NovaServe Logo" />
</p>

# novaserve-core

> Compiler engine, DAG dependency solver, Nova IR (1.0.0) validator, and state locking journal for **NovaServe**.

`novaserve-core` evaluates TypeScript application specifications, constructs canonical dependency graphs, generates least-privilege IAM policies, and calculates deployment diff plans.

## Installation

```bash
npm install novaserve-core
# or
pnpm add novaserve-core
```

## Features

- **TypeScript Compiler**: Evaluates `nova.config.ts` and resolves application topologies.
- **Nova IR 1.0.0**: Emits a deterministic, JSON-serialized Intermediate Representation with SHA-256 integrity hashing.
- **IAM Policy Generator**: Derives minimal resource-scoped IAM statements (`s3:PutObject`, `sqs:SendMessage`).
- **Diff & Cost Engine**: Computes resource creation, update, and teardown change sets with cost estimation.
- **State Locking Journal**: Append-only process locking preventing concurrent CI/CD state corruption.

## Documentation & Repository

- **Main Repository**: [https://github.com/sazamansari/NovaServe-](https://github.com/sazamansari/NovaServe-)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

MIT © Md Shadab Azam Ansari & NovaServe Contributors
