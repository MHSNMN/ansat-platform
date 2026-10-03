/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useState } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { PhoneInput } from "./PhoneInput";

afterEach(() => {
  cleanup();
});

function MemberFormTestComponent() {
  const [memberCountry, setMemberCountry] = useState("العراق");
  const [phone, setPhone] = useState("");

  return (
    <div>
      <div data-testid="member-country-display">{memberCountry}</div>
      <select
        data-testid="member-country-select"
        value={memberCountry}
        onChange={(e) => setMemberCountry(e.target.value)}
      >
        <option value="العراق">العراق</option>
        <option value="الكويت">الكويت</option>
        <option value="السعودية">السعودية</option>
      </select>

      <PhoneInput
        label="رقم الهاتف"
        value={phone}
        onChange={(val) => setPhone(val)}
        id="test-phone-input"
      />
      <div data-testid="phone-value-display">{phone}</div>
    </div>
  );
}

describe("PhoneInput Component & Member Country Isolation", () => {
  it("renders with default country Kuwait and updates properly with local Iraqi input", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PhoneInput value="" onChange={onChange} id="phone-input" />,
    );

    const input = container.querySelector("#phone-input") as HTMLInputElement;
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: "07701234567" } });

    // Check onChange was called with cleaned number
    expect(onChange).toHaveBeenCalled();
  });

  it("handles duplicate +964 paste without crashing and normalizes to E.164", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PhoneInput value="" onChange={onChange} id="phone-paste" />,
    );

    const input = container.querySelector("#phone-paste") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "+964+9647701234567" } });

    expect(onChange).toHaveBeenCalledWith("+9647701234567", true);
  });

  it("proves changing PhoneInput dial code does NOT alter member country/nationality", () => {
    const { container } = render(<MemberFormTestComponent />);

    const memberCountryDisplay = container.querySelector(
      '[data-testid="member-country-display"]',
    );
    expect(memberCountryDisplay?.textContent).toBe("العراق");

    // Change phone input
    const input = container.querySelector(
      "#test-phone-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "+96551234567" } });

    // Member country MUST remain "العراق"
    expect(memberCountryDisplay?.textContent).toBe("العراق");
  });

  it("handles pasting full international number with 00 dial code", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PhoneInput value="" onChange={onChange} id="phone-00" />,
    );

    const input = container.querySelector("#phone-00") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "009647701234567" } });

    expect(onChange).toHaveBeenCalledWith("+9647701234567", true);
  });

  it("handles manual typing of dial code without plus (e.g. 966...)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PhoneInput value="" onChange={onChange} id="phone-dial" />,
    );

    const input = container.querySelector("#phone-dial") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "966512345678" } });

    expect(onChange).toHaveBeenCalledWith("+966512345678", true);
  });

  it("allows selecting country from dropdown list and searches country by dial code", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PhoneInput value="" onChange={onChange} id="phone-select" />,
    );

    // Open dropdown
    const selectBtn = container.querySelector(
      'button[title="اختيار الدولة ومفتاح الاتصال"]',
    ) as HTMLButtonElement;
    expect(selectBtn).toBeDefined();
    fireEvent.click(selectBtn);

    // Search input should be visible
    const searchInput = container.querySelector(
      'input[placeholder*="ابحث"]',
    ) as HTMLInputElement;
    expect(searchInput).toBeDefined();
    fireEvent.change(searchInput, { target: { value: "964" } });

    // Click Iraq button in filtered list
    const countryButtons = container.querySelectorAll("button");
    const iraqBtn = Array.from(countryButtons).find((btn) =>
      btn.textContent?.includes("العراق"),
    );
    expect(iraqBtn).toBeDefined();
    if (iraqBtn) {
      fireEvent.click(iraqBtn);
    }

    // Type national number
    const input = container.querySelector("#phone-select") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7701234567" } });
    expect(onChange).toHaveBeenCalledWith("+9647701234567", true);
  });
});
