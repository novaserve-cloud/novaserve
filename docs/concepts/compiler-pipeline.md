# Compiler Pipeline

The Nova Compiler (`NovaCompiler`) orchestrates the transformation of developer application intent into executable cloud plans.

## Pipeline Stages

1. **Schema Validation**: Validates project name, memory bounds, timeouts, and resource declarations.
2. **Capability Check**: Matches requested capabilities (e.g. `compute`, `storage`) against the target provider capability matrix.
3. **Graph Topology & Cycle Detection**: Checks for missing dependencies and cycles using depth-first cycle search.
4. **Least-Privilege IAM Synthesis**: Generates narrow, scoped IAM policy statements based on actual dependency links.
5. **Digest Calculation**: Computes canonical SHA-256 hashes for each resource and the overarching graph.
