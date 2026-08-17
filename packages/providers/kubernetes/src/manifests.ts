import type { Resource } from "novaserve-core";

export const UNSUPPORTED_TYPES = ["cdn", "websocket", "email", "search", "auth"];

export function generateManifests(resources: Resource[], namespace: string = "default"): string {
  let yaml = "";

  yaml += `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
---
`;

  for (const resource of resources) {
    if (UNSUPPORTED_TYPES.includes(resource.type)) {
      continue;
    }
    
    yaml += generateResourceManifest(resource, namespace);
  }

  return yaml;
}

function generateResourceManifest(resource: Resource, namespace: string): string {
  switch (resource.type) {
    case "api":
      return generateApiManifest(resource, namespace);
    case "function":
      return generateFunctionManifest(resource, namespace);
    case "queue":
      return generateQueueManifest(resource, namespace);
    case "cron":
      return generateCronManifest(resource, namespace);
    case "database":
      return generateDatabaseManifest(resource, namespace);
    case "cache":
      return generateCacheManifest(resource, namespace);
    case "storage":
      return generateStorageManifest(resource, namespace);
    case "secret":
      return generateSecretManifest(resource, namespace);
    default:
      return "";
  }
}

function generateApiManifest(resource: Resource, namespace: string): string {
  const config = resource.config as any;
  const name = resource.name;
  let yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: app
        image: ${config.image || "ghcr.io/example/" + name + ":latest"}
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  selector:
    app: ${name}
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
`;

  if (config.domain) {
    yaml += `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  rules:
  - host: ${config.domain}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${name}
            port:
              number: 80
---
`;
  }
  return yaml;
}

function generateFunctionManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  const config = resource.config as any;
  return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: function
        image: ${config.image || "ghcr.io/example/" + name + ":latest"}
---
`;
}

function generateQueueManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  const config = resource.config as any;
  return `
# Note: K8s has no native queue primitive. An external broker like Redis Streams/RabbitMQ/NATS is required.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}-worker
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}-worker
  template:
    metadata:
      labels:
        app: ${name}-worker
    spec:
      containers:
      - name: worker
        image: ${config.image || "ghcr.io/example/" + name + "-worker:latest"}
---
`;
}

function generateCronManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  const config = resource.config as any;
  return `
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  schedule: "${config.schedule || "0 * * * *"}"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cron
            image: ${config.image || "ghcr.io/example/" + name + ":latest"}
          restartPolicy: OnFailure
---
`;
}

function generateDatabaseManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  const config = resource.config as any;
  const engine = config.engine || "postgres";
  
  if (engine === "dynamodb") {
    // Unsupported engine
    return `# dynamodb is not supported natively in Kubernetes. Consider using a cloud provider.\n`;
  }

  let image = "postgres:15";
  let port = 5432;
  if (engine === "mysql") {
    image = "mysql:8";
    port = 3306;
  } else if (engine === "mongodb") {
    image = "mongo:6";
    port = 27017;
  }

  return `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  serviceName: ${name}
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: db
        image: ${image}
        ports:
        - containerPort: ${port}
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  selector:
    app: ${name}
  ports:
  - port: ${port}
  clusterIP: None
---
apiVersion: v1
kind: Secret
metadata:
  name: ${name}-credentials
  namespace: ${namespace}
type: Opaque
stringData:
  username: "REPLACE_ME"
  password: "REPLACE_ME"
---
`;
}

function generateCacheManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: redis
        image: redis:7
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  selector:
    app: ${name}
  ports:
  - port: 6379
---
`;
}

function generateStorageManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  return `
# Documented as an in-cluster substitute for true object storage; recommends pairing with MinIO
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
`;
}

function generateSecretManifest(resource: Resource, namespace: string): string {
  const name = resource.name;
  return `
apiVersion: v1
kind: Secret
metadata:
  name: ${name}
  namespace: ${namespace}
type: Opaque
stringData:
  value: "REPLACE_ME"
---
`;
}
