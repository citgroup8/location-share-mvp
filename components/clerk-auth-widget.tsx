"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

type ClerkAuthWidgetProps = {
  mode: "sign-in" | "sign-up";
};

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ClerkAuthWidget({ mode }: ClerkAuthWidgetProps) {
  const isMounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!isMounted) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        aria-busy="true"
        role="status"
      >
        <span className="sr-only">
          Loading {mode === "sign-in" ? "sign-in" : "sign-up"} form
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      {mode === "sign-in" ? (
        <>
          <SignIn
            forceRedirectUrl="/dashboard"
            appearance={{
              options: {
                logoImageUrl: "/hidden-gem-mark.svg",
                logoLinkUrl: "/",
                logoPlacement: "inside",
              },
              variables: {
                colorPrimary: "#176e50",
                colorForeground: "#20332b",
                colorBackground: "#fffefa",
              },
            }}
          />
          <a
            className="absolute bottom-5 text-sm font-semibold text-[#176e50] underline"
            href="/login"
          >
            Sign in with a local demo account
          </a>
        </>
      ) : (
        <SignUp forceRedirectUrl="/dashboard" />
      )}
    </div>
  );
}
