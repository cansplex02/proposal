"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MarketRadiusMap from "@/components/MarketRadiusMap";

type SlotData = {
  lat: number;
  lng: number;
  address: string;
  radiusKm: number;
  mapNote?: string;
  embedUrl?: string;
  externalUrl?: string;
};

type Props = {
  /** demographics HTML 갱신 시 재탐색 */
  refreshKey: string;
};

function readSlot(el: HTMLElement): SlotData | null {
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  const radiusKm = Number(el.dataset.radiusKm || "1.5");
  const address = el.dataset.address?.trim() || "";
  const mapNote = el.dataset.mapNote?.trim() || undefined;
  const embedUrl = el.dataset.embedUrl?.trim() || undefined;
  const externalUrl = el.dataset.externalUrl?.trim() || undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) return null;

  return { lat, lng, address, radiusKm, mapNote, embedUrl, externalUrl };
}

export default function MarketMapSlot({ refreshKey }: Props) {
  const [mount, setMount] = useState<{
    el: HTMLElement;
    data: SlotData;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      const slot = document.getElementById("analysis-market-map-slot");
      if (!slot) {
        setMount(null);
        return;
      }

      const data = readSlot(slot);
      if (!data) {
        setMount(null);
        return;
      }

      slot.innerHTML = "";
      setMount({ el: slot, data });
    };

    const raf = requestAnimationFrame(attach);
    const timer = window.setTimeout(attach, 60);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [refreshKey]);

  if (!mount) return null;

  return createPortal(
    <MarketRadiusMap
      lat={mount.data.lat}
      lng={mount.data.lng}
      address={mount.data.address}
      radiusKm={mount.data.radiusKm}
      mapNote={mount.data.mapNote}
      embedUrl={mount.data.embedUrl}
      externalUrl={mount.data.externalUrl}
    />,
    mount.el
  );
}
