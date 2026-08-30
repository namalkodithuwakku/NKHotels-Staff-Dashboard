import { NextRequest, NextResponse } from "next/server";
import { gmailAccessToken, importGmailMessage } from "../../../lib/gmailIntegration";
import { auditHistoricalGmailMessages } from "../../../lib/historicalReservationAudit";
import { readServerSession } from "../../../lib/serverSession";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedDays = new Set([7, 30, 90, 180, 365]);

function authorized(request: NextRequest) {
  return Boolean(readServerSession(request)) || isSupervisorRequestAuthorized(request);
}

function header(message: { payload?: { headers?: Array<{ name?: string; value?: string }> } }, name: string) {
  return message.payload?.headers?.find(item => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function gmail<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail request failed (${response.status}).`);
  return data as T;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as { days?: number; pageToken?: string | null };
    const days = Number(body.days || 30);
    if (!allowedDays.has(days)) {
      return NextResponse.json({ success: false, error: "Audit period must be 7, 30, 90, 180 or 365 days." }, { status: 400 });
    }

    const token = await gmailAccessToken();
    const query = new URLSearchParams({
      q: `newer_than:${days}d -in:sent -in:drafts -in:trash -in:spam {from:(booking.com) from:(agoda.com) from:(airbnb.com) from:(expedia.com) from:(vrbo.com) from:(trip.com) from:(makemytrip.com) from:(goibibo.com)}`,
      maxResults: "10",
    });
    if (body.pageToken) query.set("pageToken", body.pageToken);

    const list = await gmail<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(`messages?${query}`, token);
    const listed = list.messages || [];
    const candidates: string[] = [];

    for (const item of listed) {
      const message = await gmail<{ payload?: { headers?: Array<{ name?: string; value?: string }> } }>(
        `messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, token,
      );
      const from = header(message, "From").toLowerCase();
      const subject = header(message, "Subject").toLowerCase();
      const ota = /booking\.com|airbnb|agoda|expedia|vrbo|trip\.com|makemytrip|goibibo/.test(from);
      const reservation = /new booking|booking confirmation|booking confirmed|reservation confirmed|confirmed reservation|cancel|modif|amend|booking changed|reservation updated/.test(subject);
      if (ota && reservation) candidates.push(item.id);
    }

    let imported = 0;
    for (const messageId of candidates) {
      if (await importGmailMessage(messageId, token)) imported += 1;
    }

    const audit = await auditHistoricalGmailMessages(candidates);
    return NextResponse.json({
      success: true,
      days,
      scanned: listed.length,
      candidates: candidates.length,
      imported,
      ...audit,
      nextPageToken: list.nextPageToken || null,
      done: !list.nextPageToken,
    });
  } catch (error) {
    console.error("Historical reservation audit batch failed.", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Historical reservation audit failed." }, { status: 500 });
  }
}
