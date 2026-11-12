"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { SupportContactForm } from "@/components/support/support-contact-form";

export function SupportFeedbackButton() {
  const t = useTranslations("support");
  const pathname = usePathname();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const section = pathname.split("/")[2];
  const isProductPage = ["app", "accounting", "investors", "dashboard"].includes(
    section ?? ""
  );

  if (session.status !== "authenticated" || !isProductPage) return null;

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <button
          className="fixed bottom-24 right-4 z-40 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-card-foreground shadow-lg transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          type="button"
        >
          {t("feedbackButton")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
          <Dialog.Title className="text-xl font-semibold">
            {t("feedbackTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t("feedbackDescription")}
          </Dialog.Description>
          <button
            aria-label={t("close")}
            className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
          <div className="mt-5">
            <SupportContactForm
              fixedCategory="feedback"
              initialEmail={session.data?.user.email ?? ""}
              initialName={session.data?.user.name ?? ""}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
