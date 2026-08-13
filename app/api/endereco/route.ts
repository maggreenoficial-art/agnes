import {
  formatAddress,
  looksLikeCep,
  type AddressSuggestion,
} from "@/lib/address";

export const runtime = "nodejs";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "AgnesSelecao/1.0 (https://www.agnespimentel.com)",
};

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    suburb?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

type NominatimHit = {
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
};

function stateCode(state?: string) {
  const map: Record<string, string> = {
    acre: "AC",
    alagoas: "AL",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    goias: "GO",
    maranhao: "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    para: "PA",
    paraiba: "PB",
    parana: "PR",
    pernambuco: "PE",
    piaui: "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondonia: "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  };

  const raw = state?.trim() ?? "";
  if (/^[A-Z]{2}$/i.test(raw)) return raw.toUpperCase();
  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return map[key] ?? raw;
}

function extractNumber(query: string) {
  const match = query.match(/(?:n[uú]mero\s*)?(\d{1,6})\s*$/i);
  return match?.[1];
}

function finalize(parts: Omit<AddressSuggestion, "label">): AddressSuggestion | null {
  const suggestion: AddressSuggestion = {
    ...parts,
    state: stateCode(parts.state),
    label: "",
  };
  suggestion.label = formatAddress(suggestion);
  return suggestion.label ? suggestion : null;
}

function unique(list: AddressSuggestion[]) {
  return list.filter(
    (item, index) => list.findIndex((other) => other.label === item.label) === index,
  );
}

async function fromCep(cep: string): Promise<AddressSuggestion[]> {
  const digits = cep.replace(/\D/g, "");
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    cep?: string;
  };
  if (data.erro) return [];
  const suggestion = finalize({
    street: data.logradouro,
    neighborhood: data.bairro,
    city: data.localidade,
    state: data.uf,
    cep: data.cep,
  });
  return suggestion ? [suggestion] : [];
}

async function fromPhoton(query: string): Promise<AddressSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "7");
  url.searchParams.set("lat", "-22.847");
  url.searchParams.set("lon", "-43.246");

  const response = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) return [];

  const payload = (await response.json()) as { features?: PhotonFeature[] };
  const typedNumber = extractNumber(query);

  return unique(
    (payload.features ?? [])
      .map((feature) => {
        const props = feature.properties ?? {};
        const country = `${props.country ?? ""} ${props.countrycode ?? ""}`.toLowerCase();
        if (
          country &&
          !country.includes("br") &&
          !country.includes("brasil") &&
          !country.includes("brazil")
        ) {
          return null;
        }

        return finalize({
          street: props.street || props.name,
          number: props.housenumber || typedNumber,
          neighborhood: props.district || props.suburb || props.locality,
          city: props.city || props.county,
          state: props.state,
          cep: props.postcode,
        });
      })
      .filter((item): item is AddressSuggestion => Boolean(item)),
  );
}

async function fromNominatim(query: string): Promise<AddressSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "6");
  url.searchParams.set("q", query);

  const response = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) return [];

  const payload = (await response.json()) as NominatimHit[];
  const typedNumber = extractNumber(query);

  return unique(
    payload
      .map((hit) => {
        const address = hit.address ?? {};
        return finalize({
          street: address.road || address.pedestrian,
          number: address.house_number || typedNumber,
          neighborhood:
            address.suburb || address.neighbourhood || address.city_district,
          city: address.city || address.town || address.village || address.municipality,
          state: address.state,
          cep: address.postcode,
        });
      })
      .filter((item): item is AddressSuggestion => Boolean(item)),
  );
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return Response.json({ suggestions: [] as AddressSuggestion[] });
  }

  try {
    if (looksLikeCep(query)) {
      return Response.json({ suggestions: await fromCep(query) });
    }

    const photon = await fromPhoton(query);
    const suggestions = photon.length > 0 ? photon : await fromNominatim(query);
    return Response.json({ suggestions: suggestions.slice(0, 6) });
  } catch {
    return Response.json({ suggestions: [] as AddressSuggestion[] });
  }
}
