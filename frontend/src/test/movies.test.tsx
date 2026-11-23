import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { browseHrefForRow, formatVotes, toQuery, youtubeEmbedUrl } from "@/lib/movies";
import WhereToWatch from "@/components/WhereToWatch";
import SiteFooter from "@/components/SiteFooter";
import Browse from "@/pages/Browse";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));

describe("movie API helpers", () => {
  it("builds query strings without empty values", () => {
    expect(toQuery({ subgenre: "zombie", decade: "", page: 2, x: undefined })).toBe("?subgenre=zombie&page=2");
    expect(toQuery({})).toBe("");
  });

  it("maps home rows to browse links", () => {
    expect(browseHrefForRow("slasher")).toBe("/browse?subgenre=slasher");
    expect(browseHrefForRow("top-rated")).toBe("/browse?sort=rating");
    expect(browseHrefForRow("upcoming")).toBeUndefined();
    expect(browseHrefForRow(undefined)).toBeUndefined();
  });

  it("formats votes and trailer URLs", () => {
    expect(formatVotes(950)).toBe("950");
    expect(formatVotes(8200)).toBe("8.2k");
    expect(formatVotes(12000)).toBe("12k");
    expect(youtubeEmbedUrl("V6wWKNij_1M")).toBe("https://www.youtube-nocookie.com/embed/V6wWKNij_1M?autoplay=1&rel=0");
  });
});

describe("attribution", () => {
  it("footer carries the TMDB notice", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(screen.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.")).toBeInTheDocument();
  });

  it("WhereToWatch groups providers and credits TMDB and JustWatch", () => {
    render(
      <WhereToWatch
        providers={{
          region: "IN",
          link: "https://www.themoviedb.org/movie/1/watch",
          flatrate: [{ id: 8, name: "Netflix", logo: "https://image.tmdb.org/t/p/w92/n.jpg" }],
          rent: [],
          buy: [{ id: 2, name: "Apple TV", logo: "" }],
          free: [],
          ads: [],
        }}
      />,
    );
    expect(screen.getByText("Stream")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(screen.getByAltText("Netflix")).toHaveAttribute("src", "https://image.tmdb.org/t/p/w92/n.jpg");
    expect(screen.getByText("JustWatch")).toBeInTheDocument();
    expect(screen.getByText("Region: IN")).toBeInTheDocument();
  });

  it("WhereToWatch explains when nothing is available", () => {
    render(<WhereToWatch providers={null} />);
    expect(screen.getByText(/No streaming, rental or purchase options/)).toBeInTheDocument();
  });
});

describe("Browse page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads filtered results from the URL and refetches when a filter changes", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url, "http://x");
      const page = Number(u.searchParams.get("page"));
      const items = [{ id: `tmdb-${page}`, title: `Movie ${page}`, poster: "", rating: 7, duration: "", year: 1985, description: "", genre: "Horror", cast: [] }];
      return new Response(JSON.stringify({ items, total: 2, page, limit: 24, totalPages: 2, source: "tmdb" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/browse?subgenre=slasher&decade=1980"]}>
          <Routes>
            <Route path="/browse" element={<Browse />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Movie 1")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/movies/browse?subgenre=slasher&decade=1980&sort=popularity&page=1&limit=24");
    expect(screen.getByText(/2 titles lurking/)).toBeInTheDocument();
    expect((screen.getByLabelText("Sub-genre") as HTMLSelectElement).value).toBe("slasher");

    fireEvent.click(screen.getByText("Load more"));
    expect(await screen.findByText("Movie 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "rating" } });
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("sort=rating"))).toBe(true));
  });
});
