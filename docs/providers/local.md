# Local Provider (`novaserve-provider-local`)

The default provider for rapid local iteration without cloud dependencies.

## Status

**Production Ready**

## Features

- **In-process HTTP routing**: Built on top of Hono, handling incoming requests and route parameters with sub-millisecond dispatch.
- **In-memory queues**: Simulates SQS FIFO and standard queues for background workers.
- **Local file storage**: Simulates S3 object storage on the local filesystem under `.nova/storage`.
- **Zero latency**: Instant iteration without network overhead.
