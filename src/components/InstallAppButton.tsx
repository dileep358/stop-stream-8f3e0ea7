import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  return /iPhone|iPod/.test(ua) || isIPad;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIos());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  // On iOS, no prompt event — show instructions sheet.
  const canPrompt = !!deferred;
  const showButton = canPrompt || ios;

  if (!showButton) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (ios) setShowIosSheet(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition ${className}`}
      >
        <Download size={16} />
        Install App
      </button>

      {showIosSheet && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-base">Install Smart Bus</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Add to your Home Screen</p>
              </div>
              <button
                onClick={() => setShowIosSheet(false)}
                className="p-1 rounded-md hover:bg-muted"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">1</span>
                <span className="flex items-center gap-1.5">
                  Tap the <Share size={14} className="inline" /> Share button in Safari
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">2</span>
                <span className="flex items-center gap-1.5">
                  Scroll and tap <Plus size={14} className="inline" /> <b>Add to Home Screen</b>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">3</span>
                <span>Tap <b>Add</b> in the top-right corner</span>
              </li>
            </ol>
            <p className="text-[11px] text-muted-foreground mt-4">
              You must be using Safari on iOS. Chrome and other browsers on iPhone don't support installation.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
