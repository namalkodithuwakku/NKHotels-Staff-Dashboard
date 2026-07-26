"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.register("/sw.js?v=7", { updateViaCache: "none" }).then(value => {
      registration = value;
      if (registration.waiting) setUpdateReady(true);
      registration.addEventListener("updatefound", () => {
        const worker = registration?.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
    }).catch(error => console.error("PWA service worker registration failed.", error));

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const updateTimer = window.setInterval(() => void registration?.update(), 60 * 60 * 1000);
    return () => {
      window.clearInterval(updateTimer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const dismissed = window.localStorage.getItem("nkh-pwa-install-dismissed") === "1";
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !standalone && !dismissed && window.matchMedia("(max-width: 768px)").matches) setShowIosHelp(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
      if (!standalone && !dismissed && window.matchMedia("(max-width: 768px)").matches) setShowInstall(true);
    };
    const onlineState = () => setOffline(!navigator.onLine);
    onlineState();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("online", onlineState);
    window.addEventListener("offline", onlineState);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("online", onlineState);
      window.removeEventListener("offline", onlineState);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setShowInstall(false);
    setInstallPrompt(null);
  }

  function dismissInstall() {
    window.localStorage.setItem("nkh-pwa-install-dismissed", "1");
    setShowInstall(false);
    setShowIosHelp(false);
  }

  function applyUpdate() {
    navigator.serviceWorker.getRegistration().then(registration => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  }

  return <>
    {offline && <div className="pwa-network-status" role="status"><i />Offline mode · live data will resume when connected</div>}
    {showInstall && installPrompt && <aside className="pwa-install-card" aria-label="Install NKH Dashboard">
      <span>NKH</span>
      <div><strong>Install NKH Dashboard</strong><small>Faster access from your home screen</small></div>
      <button className="install" onClick={install}>Install</button>
      <button className="dismiss" onClick={dismissInstall} aria-label="Dismiss install prompt">×</button>
    </aside>}
    {showIosHelp && <aside className="pwa-install-card pwa-ios-card" aria-label="Install NKH Dashboard on iPhone">
      <span>NKH</span>
      <div><strong>Install NKH Dashboard</strong><small>Tap Share, then “Add to Home Screen”</small></div>
      <button className="dismiss" onClick={dismissInstall} aria-label="Dismiss install instructions">×</button>
    </aside>}
    {updateReady && <aside className="pwa-update-card" role="status">
      <div><strong>Dashboard update ready</strong><small>Refresh to use the newest version</small></div>
      <button onClick={applyUpdate}>Update</button>
    </aside>}
  </>;
}
