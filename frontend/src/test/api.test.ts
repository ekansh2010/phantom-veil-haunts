import { beforeEach, describe, expect, it } from "vitest";
import { authHeaders, getToken, readError, setToken, TOKEN_KEY } from "@/lib/api";

describe("api helpers", () => {
  beforeEach(() => localStorage.clear());

  it("stores, reads and clears the token", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc");
    expect(authHeaders()).toEqual({ Authorization: "Bearer abc" });
    setToken(null);
    expect(getToken()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("readError returns the API message or a fallback", async () => {
    expect(await readError(new Response(JSON.stringify({ error: "Nope" }), { status: 400 }), "fb")).toBe("Nope");
    expect(await readError(new Response("not json", { status: 500 }), "fb")).toBe("fb");
  });
});
