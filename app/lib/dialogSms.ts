const ENDPOINT = "https://esms.dialog.lk/api/v1/message-via-url/create/url-campaign";

export function normalizeSriLankanPhone(phone: string) {
  let value = String(phone || "").replace(/[^\d]/g, "");
  if (value.startsWith("0094")) value = value.slice(2);
  if (value.startsWith("0")) value = `94${value.slice(1)}`;
  if (!value.startsWith("94") || value.length < 11 || value.length > 12) {
    throw new Error(`Invalid Sri Lankan phone number: ${phone}`);
  }
  return value;
}

export function maskPhone(phone: string) {
  const value = normalizeSriLankanPhone(phone);
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function smsParts(message: string) {
  return Math.max(1, Math.ceil(String(message || "").length / 160));
}

export async function sendDialogSms(phone: string, message: string) {
  const token = process.env.DIALOG_SMS_API_TOKEN;
  const mask = process.env.DIALOG_SMS_MASK;
  if (!token || !mask) throw new Error("Dialog SMS credentials are not configured in Vercel.");
  const cleanPhone = normalizeSriLankanPhone(phone);
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) throw new Error("SMS message is empty.");

  const query = new URLSearchParams({
    esmsqk: token,
    list: cleanPhone,
    source_address: mask,
    message: cleanMessage.slice(0, 450),
  });
  const response = await fetch(`${ENDPOINT}?${query.toString()}`, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Dialog SMS failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
  return { phone: cleanPhone, statusCode: response.status, response: text };
}
