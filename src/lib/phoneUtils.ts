import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  getCountries,
  CountryCode,
} from "libphonenumber-js";

export interface CountryInfo {
  code: CountryCode;
  dialCode: string;
  nameAr: string;
  flag: string;
}

const getFlagEmoji = (countryCode: string) => {
  if (countryCode === "AC") return "🇦🇨";
  if (countryCode === "TA") return "🇹🇦";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const regionNames = new Intl.DisplayNames(["ar"], { type: "region" });

export const ARAB_COUNTRIES: CountryInfo[] = [
  { code: "KW", dialCode: "+965", nameAr: "الكويت", flag: "🇰🇼" },
  {
    code: "SA",
    dialCode: "+966",
    nameAr: "المملكة العربية السعودية",
    flag: "🇸🇦",
  },
  {
    code: "AE",
    dialCode: "+971",
    nameAr: "الإمارات العربية المتحدة",
    flag: "🇦🇪",
  },
  { code: "QA", dialCode: "+974", nameAr: "قطر", flag: "🇶🇦" },
  { code: "BH", dialCode: "+973", nameAr: "البحرين", flag: "🇧🇭" },
  { code: "OM", dialCode: "+968", nameAr: "عُمان", flag: "🇴🇲" },
  { code: "IQ", dialCode: "+964", nameAr: "العراق", flag: "🇮🇶" },
  { code: "EG", dialCode: "+20", nameAr: "مصر", flag: "🇪🇬" },
  { code: "JO", dialCode: "+962", nameAr: "الأردن", flag: "🇯🇴" },
  { code: "LB", dialCode: "+961", nameAr: "لبنان", flag: "🇱🇧" },
  { code: "SY", dialCode: "+963", nameAr: "سوريا", flag: "🇸🇾" },
  { code: "PS", dialCode: "+970", nameAr: "الأراضي الفلسطينية", flag: "🇵🇸" },
  { code: "YE", dialCode: "+967", nameAr: "اليمن", flag: "🇾🇪" },
  { code: "LY", dialCode: "+218", nameAr: "ليبيا", flag: "🇱🇾" },
  { code: "TN", dialCode: "+216", nameAr: "تونس", flag: "🇹🇳" },
  { code: "DZ", dialCode: "+213", nameAr: "الجزائر", flag: "🇩🇿" },
  { code: "MA", dialCode: "+212", nameAr: "المغرب", flag: "🇲🇦" },
  { code: "SD", dialCode: "+249", nameAr: "السودان", flag: "🇸🇩" },
  { code: "MR", dialCode: "+222", nameAr: "موريتانيا", flag: "🇲🇷" },
  { code: "SO", dialCode: "+252", nameAr: "الصومال", flag: "🇸🇴" },
  { code: "DJ", dialCode: "+253", nameAr: "جيبوتي", flag: "🇩🇯" },
  { code: "KM", dialCode: "+269", nameAr: "جزر القمر", flag: "🇰🇲" },
];

const _otherCountryCodes: CountryCode[] = getCountries().filter(
  (c: CountryCode) => !ARAB_COUNTRIES.some((a) => a.code === c),
);
export const OTHER_POPULAR_COUNTRIES: CountryInfo[] = _otherCountryCodes
  .map((code) => ({
    code,
    dialCode: `+${getCountryCallingCode(code)}`,
    nameAr: regionNames.of(code) || code,
    flag: getFlagEmoji(code),
  }))
  .sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));

export const ALL_SUPPORTED_COUNTRIES: CountryInfo[] = [
  ...ARAB_COUNTRIES,
  ...OTHER_POPULAR_COUNTRIES,
];

/**
 * Strips duplicate dial codes if entered or pasted (e.g. +964+964... or +964964... or 00964964...)
 */
export function cleanDuplicateDialCodes(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let cleaned = raw.trim();

  // Convert Arabic-Indic digits to standard Latin digits
  cleaned = cleaned.replace(/[٠-٩]/g, (d) =>
    (d.charCodeAt(0) - 1632).toString(),
  );

  // Normalize leading 00 to +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.substring(2);
  }

  // Replace duplicate pluses
  cleaned = cleaned.replace(/\++/g, "+");

  for (const c of ALL_SUPPORTED_COUNTRIES) {
    const dialDigits = c.dialCode.replace("+", "");
    // Pattern 1: +964+964... or +964964...
    const pattern = new RegExp(
      `^\\+${dialDigits}(\\+?|00)?${dialDigits}(\\d{4,})`,
    );
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, `+${dialDigits}$2`);
      break;
    }
  }

  return cleaned;
}

/**
 * Normalizes any phone string into standard E.164 format (+XXXXXXXXXXX)
 * Handles cleaning spaces, dashes, leading zeroes, duplicate dial codes, and defaults.
 */
export function normalizeToE164(
  raw: string,
  defaultCountry: CountryCode = "KW",
): string {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = cleanDuplicateDialCodes(raw);
  if (!cleaned) return "";

  try {
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.format("E.164");
    }
  } catch {
    // Fallback to basic sanitization
  }

  // If already starts with +, remove formatting characters
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  // If local digits only
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (!digitsOnly) return "";

  try {
    const dial = getCountryCallingCode(defaultCountry);
    return `+${dial}${digitsOnly.replace(/^0+/, "")}`;
  } catch {
    return `+${digitsOnly}`;
  }
}

/**
 * Validates whether a phone number is valid E.164 or valid for a country
 */
export function validatePhoneNumber(
  raw: string,
  countryCode?: CountryCode,
): {
  isValid: boolean;
  e164: string;
  errorAr?: string;
  country?: CountryCode;
} {
  if (!raw || !raw.trim()) {
    return { isValid: false, e164: "", errorAr: "رقم الهاتف مطلوب" };
  }

  const cleaned = cleanDuplicateDialCodes(raw);

  try {
    const parsed = parsePhoneNumberFromString(cleaned, countryCode);
    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        e164: parsed.format("E.164"),
        country: parsed.country,
      };
    }
    return {
      isValid: false,
      e164: "",
      errorAr: "رقم الهاتف غير صالح، يرجى التحقق من كود الدولة وعدد الأرقام",
    };
  } catch {
    return {
      isValid: false,
      e164: "",
      errorAr: "صيغة رقم الهاتف غير صحيحة",
    };
  }
}

/**
 * Parses an existing E.164 or raw phone string to split calling code from national number
 */
export function splitPhoneNumber(raw: string): {
  countryCode: CountryCode;
  dialCode: string;
  nationalNumber: string;
} {
  if (!raw) {
    return { countryCode: "KW", dialCode: "+965", nationalNumber: "" };
  }

  const cleaned = cleanDuplicateDialCodes(raw);

  try {
    const parsed = parsePhoneNumberFromString(cleaned);
    if (parsed) {
      const country = parsed.country || "KW";
      const dialCode = `+${parsed.countryCallingCode}`;
      const nationalNumber = parsed.nationalNumber || "";
      return { countryCode: country, dialCode, nationalNumber };
    }
  } catch {
    // fallback
  }

  // Match from known countries
  for (const c of ALL_SUPPORTED_COUNTRIES) {
    if (cleaned.startsWith(c.dialCode)) {
      return {
        countryCode: c.code,
        dialCode: c.dialCode,
        nationalNumber: cleaned.slice(c.dialCode.length).replace(/^[\s-]+/, ""),
      };
    }
  }

  return {
    countryCode: "KW",
    dialCode: "+965",
    nationalNumber: cleaned.replace(/^\+?965/, ""),
  };
}

/**
 * Converts Arabic-Indic and Persian digits to standard Latin ASCII digits (0-9)
 */
export function convertToAsciiDigits(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString())
    .replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
}

/**
 * Generates an exhaustive list of phone format variants for any phone string or input.
 * Supports:
 * - Full E.164: +9647733670682
 * - International with spaces: +964 773 367 0682
 * - Double zero prefix: 009647733670682
 * - Double zero with embedded local zero: 0096407733670682
 * - International with embedded local zero: +96407733670682
 * - Pure digits: 9647733670682
 * - Local national with zero: 07733670682
 * - Local national without zero: 7733670682
 * - Local national with spaces: 773 367 0682, 0773 367 0682
 * - Arabic-Indic / Persian digits variants
 * - Auto country-code expansion for all Arab and supported countries
 */
export function generateAllPhoneVariants(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  const converted = convertToAsciiDigits(raw).trim();
  if (!converted) return [];

  const variants = new Set<string>();

  // Add original and converted
  variants.add(raw.trim());
  variants.add(converted);

  const noSpaces = converted.replace(/[\s\-()./_]/g, "");
  if (noSpaces) variants.add(noSpaces);

  const digitsOnly = converted.replace(/\D/g, "");
  if (!digitsOnly) return Array.from(variants);

  variants.add(digitsOnly);
  variants.add(`+${digitsOnly}`);

  const withoutLeadingZeroes = digitsOnly.replace(/^0+/, "");
  if (withoutLeadingZeroes) {
    variants.add(withoutLeadingZeroes);
    variants.add(`0${withoutLeadingZeroes}`);
    variants.add(`+${withoutLeadingZeroes}`);
  }

  // Handle 00 prefix
  if (converted.startsWith("00") || noSpaces.startsWith("00")) {
    const after00 = noSpaces.replace(/^00+/, "");
    variants.add(`+${after00}`);
    variants.add(after00);
  }

  // Check against all supported country dial codes
  for (const country of ALL_SUPPORTED_COUNTRIES) {
    const dialDigits = country.dialCode.replace("+", ""); // e.g. "964"

    // Case 1: Input contains dial code (e.g. +964..., 00964..., 964...)
    if (
      noSpaces.startsWith(`+${dialDigits}`) ||
      noSpaces.startsWith(`00${dialDigits}`) ||
      digitsOnly.startsWith(dialDigits)
    ) {
      let nationalPart = "";
      if (noSpaces.startsWith(`+${dialDigits}`)) {
        nationalPart = noSpaces.slice(1 + dialDigits.length);
      } else if (noSpaces.startsWith(`00${dialDigits}`)) {
        nationalPart = noSpaces.slice(2 + dialDigits.length);
      } else if (digitsOnly.startsWith(dialDigits)) {
        nationalPart = digitsOnly.slice(dialDigits.length);
      }

      // Strip embedded leading zero if present (e.g. +9640773... -> nationalPart "0773..." -> "773...")
      const nationalClean = nationalPart.replace(/^0+/, "");
      if (nationalClean) {
        variants.add(nationalClean); // national format without a leading zero
        variants.add(`0${nationalClean}`); // national format with a leading zero
        variants.add(`+${dialDigits}${nationalClean}`); // international format with +
        variants.add(`${dialDigits}${nationalClean}`); // international digits only
        variants.add(`00${dialDigits}${nationalClean}`); // international format with 00
        variants.add(`+${dialDigits}0${nationalClean}`); // international format with embedded zero
        variants.add(`00${dialDigits}0${nationalClean}`); // 00 format with embedded zero
        variants.add(`${dialDigits}0${nationalClean}`); // digits-only format with embedded zero

        // Spaced variants
        variants.add(`+${dialDigits} ${nationalClean}`);
        variants.add(`+${dialDigits} 0${nationalClean}`);
      }
    }

    // Case 2: Input does NOT have a dial code.
    // Prepend this country's dial code
    if (
      !converted.startsWith("+") &&
      !noSpaces.startsWith("00") &&
      !digitsOnly.startsWith(dialDigits)
    ) {
      const nationalClean = digitsOnly.replace(/^0+/, "");
      if (nationalClean.length >= 7 && nationalClean.length <= 11) {
        variants.add(`+${dialDigits}${nationalClean}`);
        variants.add(`${dialDigits}${nationalClean}`);
        variants.add(`00${dialDigits}${nationalClean}`);
        variants.add(`+${dialDigits}0${nationalClean}`);
        variants.add(`00${dialDigits}0${nationalClean}`);
      }
    }
  }

  // Parse with libphonenumber-js across common countries (IQ, EG, KW, SA, AE, MA, JO, PS, SY, etc.)
  const testCountries: CountryCode[] = [
    "IQ",
    "EG",
    "KW",
    "SA",
    "AE",
    "MA",
    "JO",
    "PS",
    "SY",
    "LB",
    "YE",
    "LY",
    "TN",
    "DZ",
    "SD",
  ];
  for (const c of testCountries) {
    try {
      const parsed = parsePhoneNumberFromString(
        noSpaces.startsWith("+") ? noSpaces : converted,
        c,
      );
      if (parsed && parsed.isValid()) {
        const e164 = parsed.format("E.164");
        const nat = parsed.nationalNumber;
        variants.add(e164);
        variants.add(e164.replace("+", ""));
        variants.add(`00${e164.replace("+", "")}`);
        if (nat) {
          variants.add(nat);
          variants.add(`0${nat}`);
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(variants).filter(Boolean);
}
