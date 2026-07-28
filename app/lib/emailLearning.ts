export function emailAddress(value: string) {
  return (value.match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase();
}
export function emailSubjectPattern(value: string) {
  return value.toLowerCase().replace(/\bhttps?:\/\/\S+/g, " ").replace(/\b[a-z0-9]{8,}\b/g, "{id}")
    .replace(/\b\d+\b/g, "{n}").replace(/[^a-z{}]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || "(no subject)";
}
export function protectedOperationalEmail(subject: string, body: string) {
  return /\b(new booking|new reservation|reservation confirmed|cancel(?:led|ed|lation)|modif(?:ied|ication)|amend(?:ed|ment)|guest message|new message|payment failed|payment issue|card declined|availability|booking inquiry|booking enquiry|complaint|urgent|last.minute booking)\b/i.test(`${subject}\n${body.slice(0, 3000)}`);
}
