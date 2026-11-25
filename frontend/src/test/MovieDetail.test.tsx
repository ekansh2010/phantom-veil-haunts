import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MovieDetail from "@/pages/MovieDetail";

const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string }, loading: true } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const movie = { id: "3", title: "The Whisper", poster: "/p.jpg", rating: 9.1, duration: "1h 52m", year: 2025, description: "d", genre: "Supernatural Horror", cast: [] };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/movie/3"]}>
      <Routes>
        <Route path="/movie/:id" element={<MovieDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("MovieDetail watchlist button", () => {
  beforeEach(() => {
    toast.mockReset();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(json(url.endsWith("/similar") ? [] : movie))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is disabled while the session check runs, so a signed-in user is never told to log in", async () => {
    auth.value = { user: null, loading: true };
    renderDetail();
    const button = await screen.findByRole("button", { name: /my list/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(toast).not.toHaveBeenCalled();
  });

  it("asks anonymous visitors to log in once the session check is done", async () => {
    auth.value = { user: null, loading: false };
    renderDetail();
    const button = await screen.findByRole("button", { name: /my list/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Login required" }));
  });
});
