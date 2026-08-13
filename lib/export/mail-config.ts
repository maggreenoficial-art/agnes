export function getExportEmail() {
  return process.env.EXPORT_EMAIL?.trim() ?? "";
}

export function isMailConfigured() {
  if (!getExportEmail()) return false;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  if (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) return true;
  return false;
}

export function mailConfigError() {
  if (!getExportEmail()) {
    return "Defina EXPORT_EMAIL no .env.local com o endereço que deve receber as fichas.";
  }
  if (!process.env.RESEND_API_KEY?.trim() && !(process.env.SMTP_USER && process.env.SMTP_PASS)) {
    return "Para enviar, configure SMTP_USER e SMTP_PASS (Gmail com senha de app) ou RESEND_API_KEY.";
  }
  return null;
}
