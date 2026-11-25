import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TOKEN_KEY } from "@/lib/api";

const user = { id: "u_1", email: "raven@veil.test", username: "Raven", role: "user", favorite_genre: "", avatar_url: "", created_at: "2026-01-01T00:00:00.000Z" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let ctx: ReturnType<typeof useAuth>;
const Probe = () => {
  ctx = useAuth();
  return <div data-testid="state">{ctx.loading ? "loading" : ctx.user ? `user:${ctx.user.username}` : "anon"}</div>;
};
const renderAuth = () => render(<AuthProvider><Probe /></AuthProvider>);

describe("AuthProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is anonymous without a stored token and makes no request", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores the session from a stored token via /api/auth/me", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    fetchMock.mockResolvedValueOnce(json({ user }));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("user:Raven"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { headers: { Authorization: "Bearer tok" } });
    expect(ctx.session?.access_token).toBe("tok");
  });

  it("drops an expired/revoked token", async () => {
    localStorage.setItem(TOKEN_KEY, "old");
    fetchMock.mockResolvedValueOnce(json({ error: "Token is invalid or expired" }, 401));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("signIn stores the token and user", async () => {
    renderAuth();
    fetchMock.mockResolvedValueOnce(json({ token: "new-token", user }));
    let result: { error: Error | null } = { error: null };
    await act(async () => {
      result = await ctx.signIn("raven@veil.test", "Spooky123");
    });
    expect(result.error).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token");
    expect(screen.getByTestId("state").textContent).toBe("user:Raven");
  });

  it("signIn surfaces the API error message", async () => {
    renderAuth();
    fetchMock.mockResolvedValueOnce(json({ error: "Invalid email or password" }, 401));
    let result: { error: Error | null } = { error: null };
    await act(async () => {
      result = await ctx.signIn("raven@veil.test", "nope");
    });
    expect(result.error?.message).toBe("Invalid email or password");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("signUp omits a blank username and logs the user in", async () => {
    renderAuth();
    fetchMock.mockResolvedValueOnce(json({ token: "t2", user }, 201));
    await act(async () => {
      await ctx.signUp("raven@veil.test", "Spooky123", "   ");
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: "raven@veil.test", password: "Spooky123" });
    expect(localStorage.getItem(TOKEN_KEY)).toBe("t2");
  });

  it("signOut calls the API and clears the session", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    fetchMock.mockResolvedValueOnce(json({ user }));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("user:Raven"));
    fetchMock.mockResolvedValueOnce(json({ message: "Signed out" }));
    await act(async () => {
      await ctx.signOut();
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer tok" } });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId("state").textContent).toBe("anon");
  });

  it("signOut clears the session before the (token-revoking) logout call returns", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    fetchMock.mockResolvedValueOnce(json({ user }));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("user:Raven"));
    let finishLogout: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (finishLogout = r)));
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = ctx.signOut();
    });
    // Logout still in flight: nothing may keep using the revoked token.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId("state").textContent).toBe("anon");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer tok" } });
    await act(async () => {
      finishLogout(json({ message: "Signed out" }));
      await done;
    });
  });

  it("resetPassword posts to /api/auth/forgot-password", async () => {
    renderAuth();
    fetchMock.mockResolvedValueOnce(json({ message: "ok" }));
    let result: { error: Error | null } = { error: new Error("x") };
    await act(async () => {
      result = await ctx.resetPassword("raven@veil.test");
    });
    expect(result.error).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/forgot-password");
  });
});
