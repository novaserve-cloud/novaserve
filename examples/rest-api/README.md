# REST API Example — NovaServe

A complete CRUD REST API demonstrating route parameters, JSON request body parsing, and status codes.

## Endpoints

- `GET /users` — List all registered users
- `GET /users/:id` — Retrieve a single user by ID
- `POST /users` — Create a new user (expects `{ "name": "...", "email": "..." }`)

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local dev server**:
   ```bash
   nova dev
   ```

3. **Interact with the API**:
   ```bash
   # List users
   curl http://localhost:3000/users

   # Create user
   curl -X POST http://localhost:3000/users \
     -H "Content-Type: application/json" \
     -d '{"name": "Charlie Rose", "email": "charlie@example.com"}'

   # Get user by ID
   curl http://localhost:3000/users/3
   ```

4. **Plan & Deploy**:
   ```bash
   nova plan
   nova deploy
   ```
