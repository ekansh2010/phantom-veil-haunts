import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { api } from "../helpers";
import request from "supertest";
import path from "path";
import fs from "fs";
import os from "os";

describe("app infrastructure", () => {
  it("GET /api/health reports a connected database", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "alive in the veil", db: "connected" });
    expect(typeof res.body.time).toBe("string");
  });

  it("GET /health is an alias", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body.db).toBe("connected");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await api().get("/api/does-not-exist?x=1");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ error: "Route GET /api/does-not-exist not found" });
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Malformed JSON body" });
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request body too large" });
  });

  it("sets security headers and hides x-powered-by", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("allows CORS from any origin outside production by default", async () => {
    const res = await api().get("/api/health").set("Origin", "http://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("http://example.com");
  });

  it("serves the SPA (with deep-link fallback) when a static dir is configured", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pv-static-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<html>veil</html>");
    const spa = createApp({ staticDir: dir, autoConnect: false });
    const deep = await request(spa).get("/movie/3");
    expect(deep.status).toBe(200);
    expect(deep.text).toContain("veil");
    const root = await request(spa).get("/");
    expect(root.status).toBe(200);
    expect(root.text).toContain("veil");
    // API 404s stay JSON even with the SPA fallback enabled.
    const api404 = await request(spa).get("/api/nope");
    expect(api404.status).toBe(404);
    expect(api404.body.error).toMatch(/not found/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
