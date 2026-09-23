# Hello World Example — NovaServe

The simplest possible NovaServe application demonstrating local development and deployment.

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start local development**:
   ```bash
   nova dev
   ```

3. **Test the endpoint**:
   ```bash
   curl http://localhost:3000/hello
   ```

   Response:
   ```json
   {
     "message": "Hello from NovaServe! 🚀",
     "timestamp": "2026-09-23T16:00:00.000Z"
   }
   ```

4. **Preview Infrastructure Plan**:
   ```bash
   nova plan
   ```

5. **Deploy**:
   ```bash
   nova deploy
   ```
