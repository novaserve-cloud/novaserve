# Deployment Engine Architecture

Deep dive into `DeploymentEngine`.

## Features

- **Topological Staging**: Executes infrastructure, compute, and API gateway phases in strict dependency order.
- **Append-Only Journal**: Records every state transition step into `.nova/journal.json` to enable deterministic rollbacks.
- **Process Locking**: Prevents concurrent deployments from corrupting active state.
