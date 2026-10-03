import React, { useState, useEffect, useRef } from "react";
import {
  ALL_SUPPORTED_COUNTRIES,
  CountryInfo,
  splitPhoneNumber,
  validatePhoneNumber,
} from "../../lib/phoneUtils";
import { ChevronDown, Search, Check } from "lucide-react";

export interface PhoneInputProps {
  value?: string;
  onChange: (e164Value: string, isValid: boolean) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  theme?: "dark" | "light";
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value = "",
  onChange,
  label,
  required = false,
  disabled = false,
  error,
  id,
  className = "",
  placeholder = "5X XXX XXXX",
  theme = "dark",
}) => {
  const initial = splitPhoneNumber(value);
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    const found = ALL_SUPPORTED_COUNTRIES.find(
      (c) => c.code === initial.countryCode,
    );
    return found || ALL_SUPPORTED_COUNTRIES[0];
  });
  const [nationalNumber, setNationalNumber] = useState<string>(
    initial.nationalNumber,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize when value changes externally
  useEffect(() => {
    if (value) {
      const split = splitPhoneNumber(value);
      const match = ALL_SUPPORTED_COUNTRIES.find(
        (c) => c.code === split.countryCode,
      );
      if (match && match.code !== selectedCountry.code) {
        setSelectedCountry(match);
      }
      setNationalNumber(split.nationalNumber);
    }
  }, [value, selectedCountry.code]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery("");

    // Recompute E.164
    const full = `${country.dialCode}${nationalNumber.replace(/\D/g, "")}`;
    const validation = validatePhoneNumber(full, country.code);
    onChange(validation.isValid ? validation.e164 : full, validation.isValid);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;

    // Check if the user pasted a full number with + dial code
    if (rawVal.startsWith("+") || rawVal.startsWith("00")) {
      const parsed = splitPhoneNumber(
        rawVal.startsWith("00") ? "+" + rawVal.substring(2) : rawVal,
      );
      const match = ALL_SUPPORTED_COUNTRIES.find(
        (c) => c.code === parsed.countryCode,
      );
      if (match) {
        setSelectedCountry(match);
      }
      setNationalNumber(parsed.nationalNumber);

      const full = `${match ? match.dialCode : selectedCountry.dialCode}${parsed.nationalNumber.replace(/\D/g, "")}`;
      const validation = validatePhoneNumber(
        full,
        match ? match.code : selectedCountry.code,
      );
      onChange(validation.isValid ? validation.e164 : full, validation.isValid);
      return;
    }

    // Allow digits, spaces, dashes
    let cleaned = rawVal.replace(/[^\d\s-]/g, "");

    // Check if the user typed or pasted another country's dial code without + (only for codes with length >= 3 like 964, 966, etc.)
    const foundByDial = ALL_SUPPORTED_COUNTRIES.find((c) => {
      const dialDigits = c.dialCode.replace("+", "");
      return (
        dialDigits.length >= 3 &&
        cleaned.startsWith(dialDigits) &&
        cleaned.length > dialDigits.length + 5
      );
    });

    if (foundByDial) {
      setSelectedCountry(foundByDial);
      const dialDigits = foundByDial.dialCode.replace("+", "");
      cleaned = cleaned.substring(dialDigits.length).trim().replace(/^0+/, "");
    } else {
      // Prevent typing the dial code manually inside the input (e.g. typing 964 again for Iraq)
      const dialNoPlus = selectedCountry.dialCode.replace("+", "");
      if (
        cleaned.startsWith(dialNoPlus) &&
        cleaned.length > dialNoPlus.length
      ) {
        cleaned = cleaned
          .substring(dialNoPlus.length)
          .trim()
          .replace(/^0+/, "");
      }
    }

    setNationalNumber(cleaned);

    const activeCountry = foundByDial || selectedCountry;
    const full = `${activeCountry.dialCode}${cleaned.replace(/\D/g, "")}`;
    const validation = validatePhoneNumber(full, activeCountry.code);
    onChange(validation.isValid ? validation.e164 : full, validation.isValid);
  };

  const cleanSearch = (searchQuery || "").trim().replace("+", "");
  const searchLower = (searchQuery || "").toLowerCase();
  const filteredCountries = ALL_SUPPORTED_COUNTRIES.filter(
    (c) =>
      (c.nameAr && c.nameAr.includes(searchQuery)) ||
      (c.dialCode && c.dialCode.includes(searchQuery)) ||
      (cleanSearch &&
        c.dialCode &&
        c.dialCode.replace("+", "").includes(cleanSearch)) ||
      (c.code && c.code.toLowerCase().includes(searchLower)),
  );

  const isDark = theme === "dark";

  return (
    <div
      className={`space-y-1.5 text-right ${className}`}
      id={id ? `${id}-container` : undefined}
    >
      {label && (
        <label
          className={`block text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div
        className="relative flex items-stretch gap-2"
        dir="ltr"
        ref={dropdownRef}
      >
        {/* Country Dial Code Selector */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`h-full px-3 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800"
                : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            title="اختيار الدولة ومفتاح الاتصال"
          >
            <span className="text-base">{selectedCountry.flag}</span>
            <span dir="ltr" className="font-mono">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown size={14} className="opacity-60" />
          </button>

          {/* Searchable Dropdown */}
          {isDropdownOpen && (
            <div
              dir="rtl"
              className={`absolute top-full left-0 mt-1.5 w-64 max-h-72 rounded-2xl border shadow-2xl z-50 overflow-hidden flex flex-col ${
                isDark
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Search bar */}
              <div
                className={`p-2 border-b ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="relative flex items-center">
                  <Search
                    size={14}
                    className="absolute right-3 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو الرمز..."
                    autoFocus
                    className={`w-full py-1.5 pr-8 pl-3 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500"
                        : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* Countries List */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40 text-xs">
                {filteredCountries.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    لا توجد دولة مطابقة للبحث
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full px-3 py-2.5 flex items-center justify-between transition-colors text-right ${
                          isSelected
                            ? isDark
                              ? "bg-amber-500/15 text-amber-300 font-bold"
                              : "bg-amber-50 text-amber-900 font-bold"
                            : isDark
                              ? "hover:bg-slate-800/80 text-slate-200"
                              : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{c.flag}</span>
                          <span>{c.nameAr}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            dir="ltr"
                            className="font-mono text-[11px] opacity-70"
                          >
                            {c.dialCode}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-amber-500" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* National Number Input with LTR formatting */}
        <div className="relative flex-1">
          <input
            type="tel"
            dir="ltr"
            disabled={disabled}
            required={required}
            value={nationalNumber}
            onChange={handleNumberChange}
            placeholder={placeholder}
            id={id}
            className={`w-full h-full px-3.5 py-2.5 rounded-xl border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
              isDark
                ? "bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-amber-500"
                : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500"
            } ${error ? "border-rose-500 ring-1 ring-rose-500" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};
export default PhoneInput;
