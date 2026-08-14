#!/usr/bin/env node

import("../dist/index.js").catch((err) => {
  console.error("Failed to load nova CLI. Did you build the 'novaserve' package?");
  console.error(err);
  process.exit(1);
});
