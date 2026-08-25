import { getLeadMailFrom } from "@/lib/export/mail-config";

const FOTOS_URL = "https://www.agnespimentel.com/fotos";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0] || "";
}

export function leadFotosEmailContent(nomeCompleto: string, leadId?: string) {
  const primeiro = primeiroNome(nomeCompleto);
  const link = leadId
    ? `${FOTOS_URL}?origem=email&lead=${encodeURIComponent(leadId)}`
    : `${FOTOS_URL}?origem=email`;
  const subject = primeiro
    ? `${primeiro}, a Mix Models escolheu o seu perfil`
    : "A Mix Models escolheu o seu perfil";
  const html = `
    <div style="font-family:Georgia,Times,'Times New Roman',serif;background:#04170f;padding:28px 16px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden">
        <div style="background:#04170f;padding:22px 28px;color:#c8eb4b;font-size:11px;letter-spacing:2.4px;font-weight:700;font-family:Arial,sans-serif">
          MIX MODELS · AGNES PIMENTEL · INSTITUTO IMPERATRIZ
        </div>
        <div style="padding:32px 28px 36px">
          <p style="margin:0 0 10px;color:#0c7a3e;font-size:12px;font-weight:700;letter-spacing:1.4px;font-family:Arial,sans-serif">
            CONVITE PARA A SELEÇÃO
          </p>
          <h1 style="margin:0 0 16px;font-size:28px;color:#111;line-height:1.3;font-weight:500">
            ${escapeHtml(primeiro || "Oi")}, o seu perfil chamou a nossa atenção.
          </h1>
          <p style="margin:0 0 14px;color:#333;font-size:16px;line-height:1.7">
            Você não é mais um nome no anúncio. A equipe da Mix Models já tem o seu
            cadastro na mesa, junto com a Agnes Pimentel e o Instituto Imperatriz.
          </p>
          <p style="margin:0 0 14px;color:#333;font-size:16px;line-height:1.7">
            Estamos montando o grupo da seleção presencial e queremos te avaliar
            com o cuidado que o seu perfil merece. O próximo passo é o book:
            cinco fotos só suas, para a gente te conhecer de verdade.
          </p>
          <p style="margin:0 0 24px">
            <a href="${link}" style="display:inline-block;background:#c8eb4b;color:#111;text-decoration:none;font-weight:700;border-radius:999px;padding:14px 24px;font-family:Arial,sans-serif;font-size:14px">
              Enviar o meu book
            </a>
          </p>
          <p style="margin:0 0 12px;color:#666;font-size:13px;line-height:1.6;font-family:Arial,sans-serif">
            Use o mesmo WhatsApp do anúncio, o Instagram com o perfil aberto e
            fotos com fundo liso, camiseta preta ou branca e calça jeans ou preta.
          </p>
          <p style="margin:0;color:#999;font-size:12px;font-family:Arial,sans-serif">
            Mix Models Agency · Instituto Imperatriz Leopoldinense
          </p>
        </div>
      </div>
    </div>
  `;
  return { subject, html, from: getLeadMailFrom() };
}

async function resendKey() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY não está definido.");
  return key;
}

function emailPayload(options: { nome: string; email: string; leadId: string }) {
  const { subject, html, from } = leadFotosEmailContent(
    options.nome,
    options.leadId,
  );
  return {
    from,
    to: [options.email.trim().toLowerCase()],
    subject,
    html,
    tags: [
      { name: "tipo", value: "pedido-fotos" },
      { name: "lead_id", value: options.leadId },
    ],
  };
}

export async function sendLeadFotosEmail(options: {
  nome: string;
  email: string;
  leadId: string;
}): Promise<{ id: string | null }> {
  const key = await resendKey();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload(options)),
  });
  const details = await response.text();
  if (!response.ok) {
    throw new Error(details || "Falha ao enviar com Resend.");
  }
  try {
    const json = JSON.parse(details) as { id?: string };
    return { id: json.id ?? null };
  } catch {
    return { id: null };
  }
}

export async function sendLeadFotosEmailBatch(
  leads: Array<{ id: string; nome: string; email: string }>,
): Promise<Array<{ leadId: string; emailId: string | null }>> {
  if (leads.length === 0) return [];
  const key = await resendKey();
  const payload = leads.map((lead) =>
    emailPayload({ nome: lead.nome, email: lead.email, leadId: lead.id }),
  );

  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const details = await response.text();
  if (!response.ok) {
    throw new Error(details || "Falha ao enviar o lote com Resend.");
  }

  let ids: Array<{ id?: string }> = [];
  try {
    const json = JSON.parse(details) as
      | { data?: Array<{ id?: string }> }
      | Array<{ id?: string }>;
    ids = Array.isArray(json) ? json : json.data ?? [];
  } catch {
    ids = [];
  }

  return leads.map((lead, index) => ({
    leadId: lead.id,
    emailId: ids[index]?.id ?? null,
  }));
}
