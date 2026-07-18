"use client";

export default function WhatsAppInbox({ onCreate }: { onCreate: () => void }) {
  const url = process.env.NEXT_PUBLIC_WHATSAPP_INBOX_URL || "https://nkhinbox.vercel.app";
  return <div className="channel-workspace"><section className="channel-intro whatsapp"><span>WA</span><div><small>CONNECTED WORKSPACE</small><h2>WhatsApp Inbox</h2><p>Open the team inbox to handle conversations. Tasks created from WhatsApp continue to appear in Shift Tasks with their source reference.</p></div></section><section className="channel-actions"><a className="primary-action" href={url} target="_blank" rel="noreferrer">Open WhatsApp Inbox ↗</a><button onClick={onCreate}>Create manual task</button></section><div className="safety-note"><strong>One task engine</strong><p>Email, WhatsApp, portal and manual requests use the same task queue. Full embedded conversation retrieval will be enabled when the WhatsApp Inbox API exposes conversations to this dashboard.</p></div></div>;
}
