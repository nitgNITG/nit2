// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

const { axios, replace, toast } = vi.hoisted(() => ({
    axios: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    replace: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("axios", () => ({ default: axios }));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));
vi.mock("@/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("react-hot-toast", () => ({ default: toast }));

import Articles from "@/app/[locale]/dashboard/components/Articles";
import ArticleEditor from "@/app/[locale]/dashboard/components/ArticleEditor";
import { pageWindow } from "@/app/[locale]/dashboard/components/Pagination";
import { useStore } from "@/lib/zustand";

const FUTURE = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
const PAST = "2026-10-01T08:00:00.000Z";

beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ articles: [] } as never);
    URL.createObjectURL = vi.fn(() => "blob:cover");
});
afterEach(() => cleanup());

describe("dashboard blog list", () => {
    it("shows a loading state, not 'No articles found', while articles load", () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        render(<Articles />);
        expect(screen.getByRole("status").textContent).toContain("Loading articles");
        expect(screen.queryByText("No articles found")).toBeNull();
    });

    it("says there are no articles only after an empty response", async () => {
        axios.get.mockResolvedValue({ data: { articles: [] } });
        render(<Articles />);
        expect(await screen.findByText("No articles found")).toBeTruthy();
    });

    it("offers a retry when loading fails", async () => {
        axios.get.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ data: { articles: [] } });
        render(<Articles />);
        fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
        expect(await screen.findByText("No articles found")).toBeTruthy();
        expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it("links each card to its edit page with a single locale prefix and flags scheduled ones", async () => {
        axios.get.mockResolvedValue({ data: { articles: [
            { id: "a1", title: "مجدول", content: "x", img: "/uploads/1.webp", publishedAt: FUTURE },
            { id: "a2", title: "منشور", content: "[رابط](/ar/blog/y) نص", img: "/uploads/2.webp", publishedAt: PAST },
        ] } });
        render(<Articles />);
        const edits = await screen.findAllByRole("link", { name: /Edit/ });
        expect(edits.map((l) => l.getAttribute("href"))).toEqual(["/en/dashboard/blog/article/a1", "/en/dashboard/blog/article/a2"]);
        expect(screen.getByText("Scheduled")).toBeTruthy();
        expect(screen.getByText("رابط نص")).toBeTruthy();
    });
});

describe("dashboard blog pagination", () => {
    const card = (i: number) => ({ id: `a${i}`, title: `مقال ${i}`, content: "x", img: `/uploads/${i}.webp`, publishedAt: PAST });

    it("asks the API for the page in the URL and links to its neighbours", async () => {
        axios.get.mockResolvedValue({ data: { articles: Array.from({ length: 12 }, (_, i) => card(13 + i)), total: 30, page: 2, pageSize: 12, pages: 3 } });
        render(<Articles page={2} />);
        expect(await screen.findByText("Showing 13–24 of 30")).toBeTruthy();
        expect(axios.get).toHaveBeenCalledWith("/api/blog/article?page=2&pageSize=12");
        const nav = screen.getByRole("navigation", { name: "Articles pages" });
        expect(within(nav).getByText("2").getAttribute("aria-current")).toBe("page");
        expect(within(nav).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("/en/dashboard/blog");
        expect(within(nav).getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/en/dashboard/blog?page=3");
        expect(within(nav).getByRole("link", { name: "3" }).getAttribute("href")).toBe("/en/dashboard/blog?page=3");
    });

    it("has no pager when everything fits on one page", async () => {
        axios.get.mockResolvedValue({ data: { articles: [card(1)], total: 1, page: 1, pageSize: 12, pages: 1 } });
        render(<Articles />);
        expect(await screen.findByText("Showing 1–1 of 1")).toBeTruthy();
        expect(screen.queryByRole("navigation")).toBeNull();
    });

    it("explains a page past the end instead of saying there are no articles", async () => {
        axios.get.mockResolvedValue({ data: { articles: [], total: 30, page: 9, pageSize: 12, pages: 3 } });
        render(<Articles page={9} />);
        expect(await screen.findByText(/There's no page 9/)).toBeTruthy();
        expect(screen.queryByText("No articles found")).toBeNull();
        expect(screen.getByRole("link", { name: "Go to the first page" }).getAttribute("href")).toBe("/en/dashboard/blog");
    });

    it("steps back a page after deleting the last article on the last page", async () => {
        axios.get
            .mockResolvedValueOnce({ data: { articles: [card(25)], total: 25, page: 3, pageSize: 12, pages: 3 } })
            .mockResolvedValueOnce({ data: { articles: [], total: 24, page: 3, pageSize: 12, pages: 2 } });
        axios.delete.mockResolvedValue({ data: { message: "Successfully deleted" } });
        render(<Articles page={3} />);
        fireEvent.click(await screen.findByRole("button", { name: "Delete مقال 25" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/blog?page=2"));
        expect(axios.delete).toHaveBeenCalledWith("/api/blog/article/a25");
    });

    it("pageWindow keeps first, last and the current page's neighbours", () => {
        expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
        expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
        expect(pageWindow(1, 1)).toEqual([1]);
    });
});

describe("article editor — new article", () => {
    it("blocks saving and points at the missing fields instead of sending a request", async () => {
        render(<ArticleEditor />);
        fireEvent.click(screen.getByRole("button", { name: "Publish article" }));
        expect(await screen.findByText("The Arabic title is required")).toBeTruthy();
        expect(screen.getByText("Upload a cover image")).toBeTruthy();
        expect(axios.post).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it("creates the article, then its sections in order, then opens the edit page", async () => {
        axios.post.mockImplementation(async (url: string) =>
            url === "/api/blog/article" ? { data: { article: { id: "new1" } } } : { data: { section: {} } });
        render(<ArticleEditor />);
        fireEvent.change(screen.getByLabelText("H1 title (Arabic)"), { target: { value: "مقال" } });
        fireEvent.change(screen.getByLabelText("Intro (Arabic)"), { target: { value: "مقدمة" } });
        fireEvent.change(screen.getByLabelText("Cover image file"), { target: { files: [new File(["x"], "c.jpg", { type: "image/jpeg" })] } });
        fireEvent.click(screen.getByRole("button", { name: /Add section/ }));
        fireEvent.change(screen.getByLabelText("H2 title (Arabic)"), { target: { value: "القسم الأول" } });
        fireEvent.click(screen.getByRole("button", { name: /Add item/ }));
        fireEvent.change(screen.getByLabelText("H3 title (Arabic)"), { target: { value: "بند" } });
        fireEvent.click(screen.getByRole("button", { name: "Publish article" }));

        await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/blog/article/new1"));
        const fd = axios.post.mock.calls[0][1] as FormData;
        expect(fd.get("title")).toBe("مقال");
        expect(fd.get("img")).toBeInstanceOf(File);
        expect(fd.get("publishedAt")).toBeNull();
        expect(axios.post.mock.calls[1]).toEqual(["/api/blog/section", expect.objectContaining({
            articleId: "new1", order: 0, title: "القسم الأول", list: [{ title: "بند", titleEn: "", content: "", contentEn: "" }],
        })]);
    });

    it("sends the chosen future time when the article is scheduled", async () => {
        axios.post.mockResolvedValue({ data: { article: { id: "n2" } } });
        render(<ArticleEditor />);
        fireEvent.change(screen.getByLabelText("H1 title (Arabic)"), { target: { value: "مقال" } });
        fireEvent.change(screen.getByLabelText("Intro (Arabic)"), { target: { value: "مقدمة" } });
        fireEvent.change(screen.getByLabelText("Cover image file"), { target: { files: [new File(["x"], "c.jpg")] } });
        fireEvent.click(screen.getByLabelText("Schedule for later"));
        fireEvent.change(screen.getByLabelText("Publish at (your local time)"), { target: { value: "2099-01-02T09:30" } });
        fireEvent.click(screen.getByRole("button", { name: "Schedule article" }));
        await waitFor(() => expect(axios.post).toHaveBeenCalled());
        expect((axios.post.mock.calls[0][1] as FormData).get("publishedAt")).toBe(new Date("2099-01-02T09:30").toISOString());
    });
});

describe("article editor — existing article", () => {
    const article = {
        id: "a1", slug: "live", title: "منشور", titleEn: "", content: "مقدمة", contentEn: "", metaDesc: "", metaDescEn: "", img: "/uploads/1.webp", publishedAt: PAST,
        Section: [
            { id: "s1", title: "أول", titleEn: null, content: "", contentEn: null, list: [] },
            { id: "s2", title: "ثاني", titleEn: null, content: "", contentEn: null, list: [{ title: "بند", titleEn: null, content: null, contentEn: null }] },
            { id: "s3", title: "ثالث", titleEn: null, content: "", contentEn: null, list: [] },
        ],
    };
    beforeEach(() => {
        axios.get.mockResolvedValue({ data: { article } });
        axios.put.mockResolvedValue({ data: { article: { id: "a1" } } });
        axios.delete.mockResolvedValue({ data: {} });
    });

    it("keeps links on one locale: back to the blog list and view on site", async () => {
        render(<ArticleEditor articleId="a1" />);
        expect((await screen.findByRole("link", { name: /Blog/ })).getAttribute("href")).toBe("/en/dashboard/blog");
        expect(screen.getByRole("link", { name: /View on site/ }).getAttribute("href")).toBe("/en/blog/live");
    });

    it("saves reorders and deletions, and leaves untouched sections alone", async () => {
        render(<ArticleEditor articleId="a1" />);
        fireEvent.click(await screen.findByRole("button", { name: "Move section 2 up" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete section 3" }));
        fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Changes saved"));
        expect(axios.delete).toHaveBeenCalledWith("/api/blog/section/s3");
        const puts = axios.put.mock.calls.filter(([url]) => String(url).startsWith("/api/blog/section/"));
        expect(puts.map(([url, body]) => [url, body.order])).toEqual([["/api/blog/section/s2", 0], ["/api/blog/section/s1", 1]]);
        // The article PUT carries the English fields too, so they can be cleared or filled here.
        const fd = axios.put.mock.calls[0][1] as FormData;
        expect(fd.has("titleEn") && fd.has("metaDescEn")).toBe(true);
        expect(fd.get("publishedAt")).toBeNull();
    });

    it("keeps the edits and says so when the save fails", async () => {
        axios.put.mockRejectedValueOnce({ response: { data: { message: "Another article already uses this URL" } } });
        render(<ArticleEditor articleId="a1" />);
        fireEvent.change(await screen.findByLabelText("Slug"), { target: { value: "soon" } });
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Another article already uses this URL"));
        expect(screen.getByText("Unsaved changes")).toBeTruthy();
        expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("soon");
    });

    it("shows a retry when the article can't be loaded", async () => {
        axios.get.mockRejectedValueOnce(new Error("down"));
        render(<ArticleEditor articleId="a1" />);
        expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    });
});
