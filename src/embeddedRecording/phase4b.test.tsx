// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AboutPage,
  PrivacyPage,
  TermsPage,
  SupportPage,
} from "./components/PublicPages";

describe("Phase 4(B) Public Legal Pages Verification", () => {
  it("renders About Page without secrets", () => {
    const { container } = render(
      <AboutPage theme="dark" onToggleTheme={() => {}} />,
    );
    expect(
      screen.getByText("منصة إنصات المركزية للإنتاج الصوتي"),
    ).toBeDefined();

    // Check no secrets
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("pin");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("token");
    expect(html).not.toContain("admin");
    expect(html).not.toContain("mock_");
  });

  it("renders Privacy Page without secrets", () => {
    const { container } = render(
      <PrivacyPage theme="light" onToggleTheme={() => {}} />,
    );
    expect(screen.getByText("سياسة الخصوصية")).toBeDefined();
    expect(screen.getByText("كيف نتعامل مع البيانات")).toBeDefined();

    // Check no secrets
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("pin");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("token");
    expect(html).not.toContain("mock_");
  });

  it("renders Terms Page without secrets", () => {
    const { container } = render(
      <TermsPage theme="dark" onToggleTheme={() => {}} />,
    );
    expect(screen.getAllByText("شروط الاستخدام").length).toBeGreaterThan(0);

    // Check no secrets
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("pin");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("token");
  });

  it("renders Support Page without secrets", () => {
    const { container } = render(
      <SupportPage theme="light" onToggleTheme={() => {}} />,
    );
    expect(screen.getByText("الدعم والمساعدة")).toBeDefined();

    // Check no secrets
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("pin");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("token");
  });

  it("ensures public pages have correct navigation links", () => {
    render(<AboutPage theme="dark" onToggleTheme={() => {}} />);
    const aboutLink = screen
      .getAllByText("عن المنصة")
      .find((el) => el.tagName === "A");
    const privacyLink = screen
      .getAllByText("الخصوصية")
      .find((el) => el.tagName === "A");
    const termsLink = screen
      .getAllByText("الشروط")
      .find((el) => el.tagName === "A");
    const supportLink = screen
      .getAllByText("الدعم")
      .find((el) => el.tagName === "A");

    expect(aboutLink?.getAttribute("href")).toBe("/about");
    expect(privacyLink?.getAttribute("href")).toBe("/privacy");
    expect(termsLink?.getAttribute("href")).toBe("/terms");
    expect(supportLink?.getAttribute("href")).toBe("/support");
  });
});
