export type AddressSuggestion = {
  label: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
};

function compact(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean) as string[];
}

function formatCep(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return value?.trim() || undefined;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatAddress(parts: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}) {
  const streetLine = compact([parts.street, parts.number]).join(", ");
  const cityUf = compact([parts.city, parts.state]).join(" — ");
  const cityLine = compact([parts.neighborhood, cityUf, formatCep(parts.cep)]).join(
    ", ",
  );

  return compact([streetLine, cityLine]).join(", ");
}

export function looksLikeCep(value: string) {
  return value.replace(/\D/g, "").length === 8 && /^\s*\d[\d.\-\s]*$/.test(value);
}
