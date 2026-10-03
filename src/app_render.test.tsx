/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import App from "./App";

afterEach(() => cleanup());

beforeAll(() => {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: IntersectionObserverMock,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: IntersectionObserverMock,
  });
});

describe("App smoke render", () => {
  it("renders without crashing on /", () => {
    window.history.pushState({}, "", "/");
    const { container } = render(<App />);
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });

  it("renders without crashing on /login", async () => {
    await import("./login/LoginPage");
    window.history.pushState({}, "", "/login");
    const { container } = render(<App />);
    await waitFor(
      () => expect(container.textContent).toContain("تسجيل الدخول"),
      { timeout: 3000 },
    );
  });

  it("renders without crashing on /portal", async () => {
    await import("./portal/PortalPage");
    window.history.pushState({}, "", "/portal");
    const { container } = render(<App />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
