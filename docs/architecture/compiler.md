# Compiler Architecture

Deep dive into the Nova Compiler (`NovaCompiler`).

## Core Responsibilities

1. **AST & Config Evaluation**: Resolves user `nova.config.ts` into structured in-memory representation.
2. **DAG Construction**: `DependencyGraph` builds nodes and edges from declared dependencies.
3. **Cycle Detection**: Executes depth-first search cycle detection across graph nodes.
4. **Least-Privilege IAM Synthesis**: Maps cross-resource links into minimal IAM permissions (e.g. S3 read/write actions scoped strictly to bucket ARN).
5. **Deterministic IR Emission**: Emits `NovaIRGraph` with canonical SHA-256 digests.
