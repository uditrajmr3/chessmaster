import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ShowNumbers, { SHOW_NUMBERS_KEY } from "../ShowNumbers";

beforeEach(() => window.localStorage.clear());

describe("ShowNumbers", () => {
  it("starts closed with aria wiring", () => {
    render(<ShowNumbers><p>CPL 42</p></ShowNumbers>);
    const btn = screen.getByRole("button", { name: "Show numbers" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(btn.getAttribute("aria-controls")!);
    expect(panel).toBeTruthy();
    expect(panel).not.toBeVisible();
  });

  it("toggles and remembers in localStorage", () => {
    render(<ShowNumbers><p>CPL 42</p></ShowNumbers>);
    fireEvent.click(screen.getByRole("button", { name: "Show numbers" }));
    expect(screen.getByText("CPL 42")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hide numbers" })).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(SHOW_NUMBERS_KEY)).toBe("1");
  });

  it("opens when previously remembered", () => {
    window.localStorage.setItem(SHOW_NUMBERS_KEY, "1");
    render(<ShowNumbers><p>CPL 42</p></ShowNumbers>);
    expect(screen.getByRole("button", { name: "Hide numbers" })).toBeInTheDocument();
  });

  it("syncs between instances", () => {
    render(<><ShowNumbers><p>A</p></ShowNumbers><ShowNumbers><p>B</p></ShowNumbers></>);
    fireEvent.click(screen.getAllByRole("button", { name: "Show numbers" })[0]);
    expect(screen.getAllByRole("button", { name: "Hide numbers" })).toHaveLength(2);
  });

  it("still works when localStorage throws", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    render(<ShowNumbers><p>CPL 42</p></ShowNumbers>);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Show numbers" })); });
    expect(screen.getByRole("button", { name: "Hide numbers" })).toBeInTheDocument();
    get.mockRestore(); set.mockRestore();
  });
});
