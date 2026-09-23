# `nova plan`

Generates an infrastructure execution plan by diffing the newly compiled Nova IR against the currently recorded active cloud state.

## Usage

```bash
nova plan [options]
```

## Options

- `-e, --env <environment>`: Target environment. Default: `production`.
- `--provider <provider>`: Cloud provider target. Default: `aws`.
- `--save <filepath>`: Save plan JSON file to disk for pre-approved deployment pipelines.

## Output

- Categorized actions: `create` (+), `update` (~), `replace` (!=), `delete` (-), `skip` (=)
- Attribute diffs for updated resources
- Estimated deployment execution time in seconds
- Estimated monthly cost breakdown in USD
