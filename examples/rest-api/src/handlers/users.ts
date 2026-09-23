import type { NovaContext } from "novaserve/runtime";

interface User {
  id: string;
  name: string;
  email: string;
}

const users: Map<string, User> = new Map([
  ["1", { id: "1", name: "Alice Johnson", email: "alice@example.com" }],
  ["2", { id: "2", name: "Bob Smith", email: "bob@example.com" }],
]);

export const list = async (ctx: NovaContext) => {
  return ctx.json({
    users: Array.from(users.values()),
    count: users.size,
  });
};

export const getById = async (ctx: NovaContext) => {
  const id = ctx.params?.id;
  const user = id ? users.get(id) : undefined;

  if (!user) {
    return ctx.notFound(`User with id '${id}' not found`);
  }

  return ctx.json(user);
};

export const create = async (ctx: NovaContext) => {
  const body = ctx.body<{ name: string; email: string }>();

  if (!body?.name || !body?.email) {
    return ctx.badRequest("Fields 'name' and 'email' are required");
  }

  const id = String(users.size + 1);
  const newUser: User = { id, name: body.name, email: body.email };
  users.set(id, newUser);

  return ctx.json(newUser, 201);
};
