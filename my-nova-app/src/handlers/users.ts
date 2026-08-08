import type { NovaContext } from "novaserve/runtime";

// In-memory store for demo purposes
const users: Array<{ id: string; name: string; email: string }> = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com" },
  { id: "2", name: "Bob Smith", email: "bob@example.com" },
];

export const list = async (ctx: NovaContext) => {
  return ctx.json({ users, count: users.length });
};

export const create = async (ctx: NovaContext) => {
  const body = ctx.body<{ name: string; email: string }>();

  if (!body?.name || !body?.email) {
    return ctx.badRequest("Name and email are required");
  }

  const user = {
    id: String(users.length + 1),
    name: body.name,
    email: body.email,
  };

  users.push(user);
  return ctx.json({ user }, 201);
};

export const get = async (ctx: NovaContext) => {
  const user = users.find((u) => u.id === ctx.params.id);

  if (!user) {
    return ctx.notFound(`User ${ctx.params.id} not found`);
  }

  return ctx.json({ user });
};
