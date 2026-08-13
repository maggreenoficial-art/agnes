"use client";

import { useEffect } from "react";
import {
  clearPendingLead,
  readPendingLead,
  trackMetaEvent,
} from "./MetaPixel";

export function LeadConfirmation({
  inscricaoId,
  firstName,
}: {
  inscricaoId: string;
  firstName: string;
}) {
  useEffect(() => {
    const sentKey = `agnes_lead_sent_${inscricaoId}`;
    try {
      if (sessionStorage.getItem(sentKey)) return;
    } catch {
      /* ignore */
    }

    const pending = readPendingLead();
    const eventId = pending?.eventId ?? crypto.randomUUID();

    void trackMetaEvent("Lead", {
      eventId,
      email: pending?.email,
      phone: pending?.phone,
      firstName: pending?.firstName || firstName,
      lastName: pending?.lastName,
    }).then(() => {
      try {
        sessionStorage.setItem(sentKey, "1");
      } catch {
        /* ignore */
      }
      clearPendingLead();
    });
  }, [firstName, inscricaoId]);

  return null;
}
