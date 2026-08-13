"use client";

import { useEffect, useRef } from "react";
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
    skipBrowser?: boolean;
    testEventCode?: string | null;
  },
) {
  const eventId = extra?.eventId ?? crypto.randomUUID();

  if (!extra?.skipBrowser) {
    window.fbq?.("track", eventName, {}, { eventID: eventId });
  }

  const params = new URLSearchParams(window.location.search);
  const testEventCode =
    extra?.testEventCode ||
    params.get("test_event_code") ||
    params.get("meta_test");

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
      testEventCode,
    }),
  }).catch(() => undefined);

  return eventId;
}

export function MetaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstLoad = useRef(true);

  useEffect(() => {
    const testEventCode =
      searchParams.get("test_event_code") || searchParams.get("meta_test");
    const skipBrowser = firstLoad.current;
    firstLoad.current = false;

    const timer = window.setTimeout(() => {
      trackMetaEvent("PageView", { skipBrowser, testEventCode });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}
