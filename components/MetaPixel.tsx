"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function trackMetaEvent(
  eventName: "PageView" | "Lead" | "CompleteRegistration",
  extra?: {
    eventId?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  },
) {
  const eventId = extra?.eventId ?? crypto.randomUUID();

  window.fbq?.("track", eventName, {}, { eventID: eventId });

  void fetch("/api/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
      email: extra?.email,
      phone: extra?.phone,
      firstName: extra?.firstName,
      lastName: extra?.lastName,
    }),
  }).catch(() => undefined);

  return eventId;
}

export function MetaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      trackMetaEvent("PageView");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}
