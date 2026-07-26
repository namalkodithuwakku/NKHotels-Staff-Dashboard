import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createElement } from "react";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("size") || 512);
  const size = [180, 192, 512].includes(requested) ? requested : 512;
  const maskable = request.nextUrl.searchParams.get("maskable") === "1";
  const inset = maskable ? Math.round(size * .17) : Math.round(size * .09);

  return new ImageResponse(
    createElement("div", {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: inset,
        background: "#20252b",
      },
    }, createElement("div", {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(size * .18),
        background: "linear-gradient(145deg, #30363d, #20252b)",
        boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * .008))}px rgba(255,255,255,.08)`,
      },
    }, [
      createElement("div", {
        key: "brand",
        style: {
          display: "flex",
          alignItems: "baseline",
          color: "white",
          fontSize: Math.round(size * .25),
          fontWeight: 900,
          letterSpacing: Math.round(size * -.012),
        },
      }, [
        createElement("span", { key: "nkh" }, "NKH"),
        createElement("span", {
          key: "dot",
          style: { marginLeft: Math.round(size * .022), color: "#e98a15" },
        }, "•"),
      ]),
      createElement("div", {
        key: "label",
        style: {
          marginTop: Math.round(size * .025),
          color: "#e98a15",
          fontSize: Math.round(size * .055),
          fontWeight: 800,
          letterSpacing: Math.round(size * .008),
          textTransform: "uppercase",
        },
      }, "Dashboard"),
    ])),
    { width: size, height: size },
  );
}
