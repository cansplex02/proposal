"use client";

import { useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import MarketRadiusMap from "@/components/MarketRadiusMap";
import type { MarketMapSlotData } from "@/lib/analysis/types";

type Props = {
  /** demographics HTML 갱신 시 재탐색 */
  refreshKey: string;
  /** API에서 직접 전달 (DOM data-* 파싱보다 우선) */
  marketMap?: MarketMapSlotData | null;
};

function readSlot(el: HTMLElement): MarketMapSlotData | null {
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

function renderIntoSlot(slot: HTMLElement, data: MarketMapSlotData) {
  return (
    <MarketRadiusMap
      lat={data.lat}
      lng={data.lng}
      address={data.address}
      radiusKm={data.radiusKm}
      mapNote={data.mapNote}
      embedUrl={data.embedUrl}
      externalUrl={data.externalUrl}
    />
  );
}

export default function MarketMapSlot({ refreshKey, marketMap }: Props) {
  const rootRef = useRef<Root | null>(null);
  const slotRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    const unmount = () => {
      rootRef.current?.unmount();
      rootRef.current = null;
      slotRef.current = null;
    };

    const mount = (): boolean => {
      if (cancelled) return true;

      const slot = document.getElementById("analysis-market-map-slot");
      const data = marketMap ?? (slot ? readSlot(slot) : null);
      if (!slot || !data) return false;

      if (rootRef.current && slotRef.current === slot) {
        slot.className = "analysis-market-map-root";
        rootRef.current.render(renderIntoSlot(slot, data));
        return true;
      }

      unmount();
      slot.innerHTML = "";
      slot.className = "analysis-market-map-root";
      slot.id = "analysis-market-map-slot";
      const root = createRoot(slot);
      rootRef.current = root;
      slotRef.current = slot;
      root.render(renderIntoSlot(slot, data));
      return true;
    };

    if (!mount()) {
      timer = window.setInterval(() => {
        attempts += 1;
        if (mount() || attempts >= 40) {
          if (timer !== null) window.clearInterval(timer);
        }
      }, 100);
    }

    const container = document.getElementById("analysis-demographics");
    const observer =
      container &&
      new MutationObserver(() => {
        if (!cancelled) mount();
      });
    if (observer && container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      observer?.disconnect();
      unmount();
    };
  }, [refreshKey, marketMap]);

  return null;
}
