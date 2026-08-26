export function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : "";
}

export function isZapiConfigured() {
  return Boolean(
    process.env.ZAPI_INSTANCE_ID?.trim() &&
      process.env.ZAPI_TOKEN?.trim() &&
      process.env.ZAPI_CLIENT_TOKEN?.trim(),
  );
}

export function zapiConfigError() {
  if (!process.env.ZAPI_INSTANCE_ID?.trim() || !process.env.ZAPI_TOKEN?.trim()) {
    return "Defina ZAPI_INSTANCE_ID e ZAPI_TOKEN no ambiente.";
  }
  if (!process.env.ZAPI_CLIENT_TOKEN?.trim()) {
    return "Falta o Client-Token do Z-API (painel → Segurança). Coloque em ZAPI_CLIENT_TOKEN.";
  }
  return null;
}

function zapiHeaders() {
  const token = process.env.ZAPI_CLIENT_TOKEN?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Client-Token"] = token;
  return headers;
}

function zapiUrl(path: string) {
  const instance = process.env.ZAPI_INSTANCE_ID?.trim();
  const token = process.env.ZAPI_TOKEN?.trim();
  if (!instance || !token) {
    throw new Error("Z-API não está configurada.");
  }
  return `https://api.z-api.io/instances/${instance}/token/${token}/${path.replace(/^\//, "")}`;
}

export async function sendZapiText(options: {
  phone: string;
  message: string;
}): Promise<{ id: string | null }> {
  const phone = whatsappDigits(options.phone);
  if (!phone) {
    throw new Error("Telefone inválido para o WhatsApp.");
  }

  const linkMatch = options.message.match(/https:\/\/[^\s]+/);
  const linkUrl = linkMatch?.[0];
  const payload = linkUrl
    ? {
        phone,
        message: options.message,
        image: "https://www.agnespimentel.com/img-base.png",
        linkUrl,
        title: "Enviar as 5 fotos",
        linkDescription: "Conclua a inscrição da Mix Models",
        delayTyping: 3,
        delayMessage: 2,
      }
    : {
        phone,
        message: options.message,
        delayTyping: 3,
        delayMessage: 2,
      };

  const response = await fetch(zapiUrl(linkUrl ? "send-link" : "send-text"), {
    method: "POST",
    headers: zapiHeaders(),
    body: JSON.stringify(payload),
  });
  const details = await response.text();
  if (!response.ok) {
    throw new Error(zapiErrorMessage(details) || "Falha ao enviar no WhatsApp.");
  }
  try {
    const json = JSON.parse(details) as { messageId?: string; id?: string };
    return { id: json.messageId ?? json.id ?? null };
  } catch {
    return { id: null };
  }
}

function zapiErrorMessage(details: string) {
  try {
    const json = JSON.parse(details) as { error?: string; message?: string };
    return json.error || json.message || details;
  } catch {
    return details;
  }
}
