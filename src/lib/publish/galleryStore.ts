import fs from "fs";
import path from "path";
import { publishPaths, publicGalleryPath } from "@/lib/publish/paths";
import type { GalleryDocument, GalleryIndexEntry } from "@/lib/publish/types";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function draftGalleryPath(slug: string): string {
  return path.join(publishPaths.galleriesDraft, `${slug}.json`);
}

function publishedGalleryPath(slug: string): string {
  return path.join(publishPaths.galleriesPublished, `${slug}.json`);
}

export function loadDraftGallery(slug: string): GalleryDocument | null {
  return readJson<GalleryDocument>(draftGalleryPath(slug));
}

export function loadPublishedGallery(slug: string): GalleryDocument | null {
  return readJson<GalleryDocument>(publishedGalleryPath(slug));
}

export function saveDraftGallery(doc: GalleryDocument): GalleryDocument {
  if (process.env.VERCEL) {
    throw new Error("Vercel에서는 로컬 파일 저장이 불가합니다.");
  }
  const next: GalleryDocument = {
    ...doc,
    updatedAt: new Date().toISOString(),
    publish: {
      status: doc.publish?.status ?? "draft",
      publishedAt: doc.publish?.publishedAt,
    },
  };
  writeJson(draftGalleryPath(doc.slug), next);
  return next;
}

export function loadGalleriesIndex(): GalleryIndexEntry[] {
  return readJson<GalleryIndexEntry[]>(publishPaths.galleriesIndex) ?? [];
}

function upsertGalleryIndex(entry: GalleryIndexEntry) {
  const list = loadGalleriesIndex();
  const i = list.findIndex((e) => e.slug === entry.slug);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  list.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  writeJson(publishPaths.galleriesIndex, list);
}

export function publishGallery(slug: string): GalleryDocument {
  const draft = loadDraftGallery(slug);
  if (!draft) throw new Error(`draft 갤러리 없음: ${slug}`);
  const publishedAt = new Date().toISOString();
  const published: GalleryDocument = {
    ...draft,
    publish: { status: "published", publishedAt },
    updatedAt: publishedAt,
  };
  writeJson(publishedGalleryPath(slug), published);
  saveDraftGallery(published);

  upsertGalleryIndex({
    slug,
    clinicName: published.clinicName,
    label: published.clinicName || slug,
    publicPath: publicGalleryPath(slug),
    status: "published",
    publishedAt,
    updatedAt: publishedAt,
  });

  return published;
}
