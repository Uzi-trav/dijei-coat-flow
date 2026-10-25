import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, Share2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isRunningStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && Boolean(navigator.standalone));
}

export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isRunningStandalone);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [registrationError, setRegistrationError] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error: unknown) {
      console.error("App update registration failed:", error);
      setRegistrationError(true);
    },
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallPrompt(null);
    } catch (error) {
      console.error("App installation prompt failed:", error);
      setShowInstructions(true);
    }
  }

  if ((installed && !needRefresh) || dismissed) return null;
  if (!needRefresh && !registrationError && !showInstructions && !installPrompt && !navigator.onLine) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl border bg-background p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:bottom-5"
      aria-label={t("pwa.title")}
    >
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-lg border object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{needRefresh ? t("pwa.updateTitle") : t("pwa.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {needRefresh ? t("pwa.updateDescription") : t("pwa.description")}
          </p>
          {showInstructions && (
            <p className="mt-2 text-sm" role="note">
              <Share2 className="mr-1 inline size-4" aria-hidden="true" />
              {t("pwa.instructions")}
            </p>
          )}
          {registrationError && (
            <p className="mt-2 text-sm text-destructive" role="alert">{t("pwa.updateError")}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {needRefresh ? (
              <Button size="sm" onClick={() => void updateServiceWorker(true)}>
                <RefreshCw aria-hidden="true" />{t("pwa.updateNow")}
              </Button>
            ) : !installed ? (
              <Button size="sm" onClick={() => void installApp()}>
                <Download aria-hidden="true" />{showInstructions ? t("pwa.gotIt") : t("pwa.install")}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} aria-label={t("pwa.dismiss")}>
              <X aria-hidden="true" />{t("pwa.dismiss")}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
