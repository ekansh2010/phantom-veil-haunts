import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "@/pages/ResetPassword";

const TOKEN = "a".repeat(64);

const renderAt = (search: string) => {
  window.history.pushState({}, "", `/reset-password${search}`);
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  );
};

describe("ResetPassword page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows an error state without a valid token", () => {
    renderAt("?token=bogus");
    expect(screen.getByText("Invalid or expired reset link.")).toBeInTheDocument();
  });

  it("submits the token and new password to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderAt(`?token=${TOKEN}`);

    fireEvent.change(screen.getByPlaceholderText("New password"), { target: { value: "Reborn12345" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), { target: { value: "Reborn12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/reset-password");
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN, password: "Reborn12345" });
  });

  it("does not call the API when passwords differ", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderAt(`?token=${TOKEN}`);
    fireEvent.change(screen.getByPlaceholderText("New password"), { target: { value: "Reborn12345" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), { target: { value: "Different123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
