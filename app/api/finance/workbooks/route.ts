import { NextRequest, NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { authorizeNKH } from "../../../lib/nkhAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const sources = {
  fees: { env: "NKH_FINANCE_FEES_FILE_ID", name: "Service Fees 2026.xlsx" },
  accounts: { env: "NKH_FINANCE_ACCOUNTS_FILE_ID", name: "Monthly Accounts.xlsx" },
} as const;
function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers });
}
async function accessToken(): Promise<string> {
  const email = process.env.NKH_FINANCE_GOOGLE_CLIENT_EMAIL;
  const key = process.env.NKH_FINANCE_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Not configured");
  const now = Math.floor(Date.now()/1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = encode({alg:"RS256",typ:"JWT"}) + "." + encode({iss:email,scope:"https://www.googleapis.com/auth/drive.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+300});
  const signature = createSign("RSA-SHA256").update(claims).sign(key,"base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:claims+"."+signature}),cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error("Token unavailable");
  const data = await response.json();
  if (typeof data.access_token !== "string") throw new Error("Token unavailable");
  return data.access_token;
}
export async function GET(request: NextRequest) {
  const auth = await authorizeNKH(request,"finance.read");
  if (!auth.ok) return failure(auth.status,"Finance access unavailable.");
  const source = request.nextUrl.searchParams.get("source");
  if (source !== "fees" && source !== "accounts") return failure(400,"Invalid workbook.");
  const config = sources[source];
  const id = process.env[config.env];
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return failure(503,"Workbook connection not configured.");
  try {
    const token = await accessToken();
    const url = "https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(id);
    const options = {headers:{Authorization:"Bearer "+token},cache:"no-store" as const,signal:AbortSignal.timeout(20000)};
    const meta = await fetch(url+"?fields=name,mimeType,size,modifiedTime&supportsAllDrives=true",options);
    if (!meta.ok) return failure(503,"Workbook unavailable.");
    const data = await meta.json();
    if (data.mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return failure(503,"Unexpected workbook format.");
    if (request.nextUrl.searchParams.get("download") !== "1") return NextResponse.json({name:config.name,modifiedTime:data.modifiedTime,size:data.size},{headers});
    const response = await fetch(url+"?alt=media&supportsAllDrives=true",options);
    if (!response.ok || !response.body) return failure(503,"Workbook unavailable.");
    return new NextResponse(response.body,{headers:{...headers,"Content-Type":data.mimeType,"Content-Disposition":'attachment; filename="'+config.name+'"'}});
  } catch { return failure(503,"Workbook connection unavailable."); }
}
