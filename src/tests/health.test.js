const test = require("node:test");
const assert = require("node:assert");
const createApp = require("../app");

test("GET /health returns 200 and correct status fields", async (t) => {
  const app = createApp();
  
  // Start server on a random ephemeral port (0)
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.data);
    assert.strictEqual(body.data.status, "ok");
    assert.ok(typeof body.data.uptime === "number");
    assert.ok(body.data.timestamp);
  } finally {
    // Ensure the server closes so the test process finishes gracefully
    await new Promise((resolve) => server.close(resolve));
  }
});
