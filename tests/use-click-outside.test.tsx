// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useClickOutside from "@/app/[locale]/hook/useClickOutSide";

// The mousedown listener used to be bound once with the `open` value of the first
// render, so a modal that opened later (open: false → true) never gave the page its
// scroll back when closed by an outside click — body stayed overflow-y: hidden.

const clickOutside = () => act(() => { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });

describe("useClickOutside", () => {
    afterEach(() => { document.body.style.overflowY = ""; });

    it("restores page scroll when `open` became true after the first render", () => {
        const close = vi.fn();
        const inside = document.createElement("div");
        document.body.appendChild(inside);
        const { result, rerender } = renderHook(({ open }) => useClickOutside(close, open), { initialProps: { open: false } });
        (result.current as { current: HTMLDivElement | null }).current = inside;

        rerender({ open: true });
        document.body.style.overflowY = "hidden";
        clickOutside();

        expect(close).toHaveBeenCalledTimes(1);
        expect(document.body.style.overflowY).toBe("auto");
    });

    it("leaves page scroll alone when not open, and ignores clicks inside", () => {
        const close = vi.fn();
        const inside = document.createElement("div");
        document.body.appendChild(inside);
        const { result } = renderHook(() => useClickOutside(close, false));
        (result.current as { current: HTMLDivElement | null }).current = inside;
        document.body.style.overflowY = "hidden";

        act(() => { inside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
        expect(close).not.toHaveBeenCalled();

        clickOutside();
        expect(close).toHaveBeenCalledTimes(1);
        expect(document.body.style.overflowY).toBe("hidden");
    });
});
