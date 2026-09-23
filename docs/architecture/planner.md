# Planner Architecture

Deep dive into the Nova Diff and Planning Engine (`NovaPlanner`).

## Diff Categories

- **`create` (+)**: Resource defined in Nova IR but absent from active state.
- **`update` (~)**: Resource exists in both, but mutable attributes have changed.
- **`replace` (!=)**: Resource exists in both, but an immutable attribute changed requiring recreate.
- **`skip` (=)**: Config hash matches exactly.
- **`delete` (-)**: Resource present in active state but removed from Nova IR.

## Cost Estimation & Safety

Each action includes:
- Estimated deployment execution duration in seconds.
- Approximate monthly cost in USD based on resource sizing.
- Data loss warning flag for stateful replacements (databases, storage).
