// @vitest-environment node
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";

describe("server functionality", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.APP_MESSAGE = "Hello from EX.CO";
    process.env.APP_VERSION = "test-version";
    process.env.HOSTNAME = "exco-web-abc123";

    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => {
      server.once("listening", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("server did not bind a port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("GET /healthz returns 200 ok", async () => {
    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("ok");
  });

  it("GET / returns HTML with the message, version, and pod name", async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Hello from EX.CO");
    expect(body).toContain("test-version");
    expect(body).toContain("exco-web-abc123");
    expect(body).toContain('id="message"');
    expect(body).toContain('id="version"');
    expect(body).toContain('id="pod"');
  });
});
