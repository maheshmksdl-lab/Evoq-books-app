// The mock environment is anchored to a fixed "today" so every module shows coherent data.
export const TODAY = "2026-11-17";
export const BOOKS_START = "2025-04-01";
export const SIMULATED_USER = "Meera Iyer";

export const PRIMARY_ENTITY_ID = "e1";
export const SECOND_ENTITY_ID = "e2";

export const INDIAN_STATES = [
  "Maharashtra", "Gujarat", "Tamil Nadu", "Karnataka", "Delhi", "Telangana", "West Bengal", "Rajasthan", "Uttar Pradesh", "Kerala",
];

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "neft", label: "NEFT" },
  { value: "rtgs", label: "RTGS" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
] as const;

export const GST_RATES = [0, 5, 12, 18, 28];
