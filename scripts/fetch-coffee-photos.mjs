#!/usr/bin/env node
/**
 * Downloads openly-licensed coffee imagery from Wikimedia Commons for the
 * Coffee Atlas and regenerates `shared/coffee/photo-pool.ts`.
 *
 *   node scripts/fetch-coffee-photos.mjs
 *
 * Only CC0 / public domain / CC BY / CC BY-SA files are kept, and every file
 * carries its author and licence through to the generated module so the UI can
 * credit it.
 *
 * Attribution accumulates in scripts/coffee-photo-credits.json; the generated
 * module contains the entries whose image is actually on disk. So curating the
 * pool means deleting the images you do not want and re-running — nothing
 * re-downloads, and the unwanted entries drop out of the module.
 */

import { mkdir, writeFile, readFile, readdir, rm, rename, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "..");
const PHOTO_DIR = path.join(ROOT, "client", "public", "coffee", "photos");
const POOL_MODULE = path.join(ROOT, "shared", "coffee", "photo-pool.ts");
const CREDITS_DB = path.join(ROOT, "scripts", "coffee-photo-credits.json");

const USER_AGENT =
  "KiteframeCoffeeAtlas/1.0 (scripts/fetch-coffee-photos.mjs; open-licensed image fetch)";

/** Search terms paired with how many keepers we want from each. */
const QUERIES = [
  ["coffee shop interior cafe", 3],
  ["espresso machine cafe barista", 3],
  ["latte art cappuccino cup", 3],
  ["coffee roaster roasting beans", 2],
  ["pour over coffee brewing", 2],
  ["cafe terrace outdoor seating", 2],
  ["coffee beans green roasted", 2],
  ["cafe counter pastries", 2],
  ["coffee cup table window", 2],
];

/**
 * Files the search keeps surfacing that do not read as a specialty cafe —
 * empty winter courtyards, apartment blocks, and the like. Listed here rather
 * than just deleted so a re-run does not fetch them again.
 */
const REJECTED_KEYS = new Set([
  "corning-museum-of-glass-20220412-01-cafe-seating-at-west-ent",
  "sosnowiec-ma-achowskieog-9-hostel-kamienica-pub-maya-tapas-b",
]);

const ALLOWED_LICENCES = [
  /^cc0/i,
  /^public domain/i,
  /^cc by(-sa)? \d/i,
  /^cc-by(-sa)?-\d/i,
];

/** Chain brands make poor stand-ins for independent specialty cafes. */
const EXCLUDE_TITLE = /starbucks|mcdonald|dunkin|costa coffee|nescaf|tim hortons/i;

function stripHtml(value) {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .replace(/^File:/, "")
    .replace(/\.[a-z]+$/i, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function search(term, limit) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: "6",
    gsrlimit: String(limit * 4),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1400",
  }).toString();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(2000 * 2 ** attempt);

    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) {
      const body = await response.json();
      return Object.values(body.query?.pages ?? {});
    }
    if (response.status !== 429 && response.status !== 503) {
      throw new Error(`Commons search failed for "${term}": ${response.status}`);
    }
  }

  throw new Error(`Commons search for "${term}" kept getting throttled.`);
}

function toCandidate(page) {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl) return null;

  const meta = info.extmetadata ?? {};
  const licence = stripHtml(meta.LicenseShortName?.value);
  if (!ALLOWED_LICENCES.some((pattern) => pattern.test(licence))) return null;
  if (EXCLUDE_TITLE.test(page.title)) return null;
  if (REJECTED_KEYS.has(slugify(page.title))) return null;
  // Portrait crops read badly in the 4:3 tiles and map popups.
  if (info.width && info.height && info.height > info.width) return null;

  const credit = stripHtml(meta.Artist?.value) || "Wikimedia Commons contributor";
  return {
    slug: slugify(page.title),
    title: stripHtml(page.title.replace(/^File:/, "")),
    thumburl: info.thumburl,
    descriptionUrl: info.descriptionurl,
    credit: credit.slice(0, 80),
    license: licence,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * upload.wikimedia.org throttles bursts hard, so downloads are spaced out and
 * retried with backoff rather than hammered in parallel.
 */
async function download(candidate) {
  const file = path.join(PHOTO_DIR, `${candidate.slug}.jpg`);
  if (existsSync(file)) return true;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(2000 * 2 ** attempt);

    const response = await fetch(candidate.thumburl, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/*" },
    });

    if (response.ok) {
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      await optimize(file);
      await sleep(750);
      return true;
    }
    if (response.status !== 429 && response.status !== 503) {
      console.warn(`  ! skipped ${candidate.slug} (${response.status})`);
      return false;
    }
  }

  console.warn(`  ! skipped ${candidate.slug} (throttled)`);
  return false;
}

/**
 * Commons thumbnails come back at full quality and can top 2 MB, which is far
 * more than a tile or gallery needs. Downscale to 1200px wide and recompress so
 * the committed images stay small. Silently left alone if ffmpeg is missing.
 */
async function optimize(file) {
  const temp = `${file}.opt.jpg`;
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      file,
      "-vf",
      "scale='min(1200,iw)':-2:flags=lanczos",
      "-q:v",
      "5",
      temp,
    ]);
  } catch {
    await rm(temp, { force: true });
    return;
  }

  const [original, optimized] = await Promise.all([stat(file), stat(temp)]);
  if (optimized.size > 0 && optimized.size < original.size) {
    await rename(temp, file);
  } else {
    await rm(temp, { force: true });
  }
}

/** Turns a Commons filename into something usable as alt text. */
function cleanTitle(title) {
  return title
    .replace(/\.(jpe?g|png|gif|tiff?|webp)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/^[\s\d]*\d{4} \d{2} \d{2}\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;-]+/, "")
    .trim();
}

/**
 * Commons author fields often carry a linked username plus a note asking to be
 * emailed on reuse. Keep the leading name and drop the rest.
 */
function cleanCredit(credit) {
  const head = credit.split("(")[0].trim();
  const name = (head.length > 1 ? head : credit).replace(/\s+/g, " ").trim();
  return name.length > 60 ? `${name.slice(0, 57).trimEnd()}...` : name;
}

function renderModule(photos) {
  const entries = photos
    .map(
      (photo) => `  {
    key: ${JSON.stringify(photo.slug)},
    src: ${JSON.stringify(`/coffee/photos/${photo.slug}.jpg`)},
    alt: ${JSON.stringify(cleanTitle(photo.title))},
    credit: ${JSON.stringify(cleanCredit(photo.credit))},
    creditUrl: ${JSON.stringify(photo.creditUrl)},
    license: ${JSON.stringify(photo.license)},
  },`,
    )
    .join("\n");

  return `// GENERATED by scripts/fetch-coffee-photos.mjs — do not edit by hand.
//
// Openly-licensed coffee imagery from Wikimedia Commons, used as stand-in
// photography for atlas entries until real photos are dropped in. Every entry
// keeps its author and licence so the UI can credit it. Files live in
// client/public/coffee/photos/.

export interface PooledPhoto {
  key: string;
  src: string;
  alt: string;
  credit: string;
  creditUrl: string;
  license: string;
}

export const PHOTO_POOL: PooledPhoto[] = [
${entries}
];

const BY_KEY = new Map(PHOTO_POOL.map((photo) => [photo.key, photo]));

/**
 * Looks up a pooled photo and shapes it for the \`Photo\` content type. Throws
 * on an unknown key so a renamed image surfaces immediately rather than
 * rendering a broken tile.
 */
export function pooledPhoto(key: string, alt?: string) {
  const photo = BY_KEY.get(key);
  if (!photo) {
    throw new Error(
      \`Unknown pooled photo "\${key}". Run scripts/fetch-coffee-photos.mjs or pick a key from PHOTO_POOL.\`,
    );
  }
  return {
    src: photo.src,
    alt: alt ?? photo.alt,
    credit: photo.credit,
    creditUrl: photo.creditUrl,
    license: photo.license,
    isPlaceholder: true,
  };
}
`;
}

async function loadCredits() {
  try {
    return JSON.parse(await readFile(CREDITS_DB, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  await mkdir(PHOTO_DIR, { recursive: true });
  const credits = await loadCredits();

  for (const [term, want] of QUERIES) {
    console.log(`Searching Commons: ${term}`);
    let taken = 0;
    for (const page of await search(term, want)) {
      if (taken >= want) break;
      const candidate = toCandidate(page);
      if (!candidate) continue;

      const known = Boolean(credits[candidate.slug]);
      if (!(await download(candidate))) continue;

      credits[candidate.slug] = {
        title: candidate.title,
        credit: candidate.credit,
        creditUrl: candidate.descriptionUrl,
        license: candidate.license,
      };
      taken += 1;
      if (!known) console.log(`  + ${candidate.slug} (${candidate.license})`);
    }
  }

  await writeFile(CREDITS_DB, `${JSON.stringify(credits, null, 2)}\n`);

  // The module lists only entries whose image survived curation, so deleting a
  // jpg is all it takes to drop a photo from the atlas.
  const onDisk = new Set(
    (await readdir(PHOTO_DIR))
      .filter((file) => file.endsWith(".jpg"))
      .map((file) => file.replace(/\.jpg$/, "")),
  );

  const pool = Object.entries(credits)
    .filter(([slug]) => onDisk.has(slug))
    .map(([slug, entry]) => ({ slug, ...entry }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  await writeFile(POOL_MODULE, renderModule(pool));

  const uncredited = [...onDisk].filter((slug) => !credits[slug]);
  if (uncredited.length > 0) {
    console.warn(
      `\nOn disk but uncredited, so excluded from the pool:\n  ${uncredited.join("\n  ")}`,
    );
  }

  console.log(`\nWrote ${pool.length} photos to shared/coffee/photo-pool.ts.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
