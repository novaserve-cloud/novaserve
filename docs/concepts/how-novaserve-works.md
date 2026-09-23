# How NovaServe Works

NovaServe treats infrastructure not as manual YAML configuration or static templates, but as **compiled software**.

## The Compilation Pipeline

```text
TypeScript Application Spec (nova.config.ts)
                    ↓
              Nova Compiler
                    ↓
      Nova Intermediate Representation (Nova IR 1.0.0)
                    ↓
         Deterministic Planner & Diff Engine
                    ↓
               Provider Adapter
                    ↓
         Real Cloud Resources (AWS, etc.)
```

1. **Evaluation**: Your TypeScript configuration is evaluated and typechecked.
2. **DAG Construction**: Cross-resource references are resolved into a Directed Acyclic Graph.
3. **IR Emission**: Emits canonical Nova IR with deterministic SHA-256 digests.
4. **Planning**: Compares new IR against live state to determine additions, updates, and deletions.
5. **Execution**: The provider adapter performs targeted API calls recorded in an append-only journal.
