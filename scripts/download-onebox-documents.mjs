#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SITE = "https://onebox.ma";
const SITEMAP = `${SITE}/product-sitemap.xml`;
const USER_AGENT = "MohasibResourceArchiver/1.0 (+local resource import; contact: local-user)";
const DEFAULT_OUTPUT = path.resolve("imports/onebox");

function parseArgs(argv) {
  const options = { output: DEFAULT_OUTPUT, delay: 1500, downloadWait: 32_000, limit: Infinity, start: 0, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") options.output = path.resolve(argv[++index]);
    else if (argument === "--delay") options.delay = Number(argv[++index]);
    else if (argument === "--download-wait") options.downloadWait = Number(argv[++index]);
    else if (argument === "--limit") options.limit = Number(argv[++index]);
    else if (argument === "--start") options.start = Number(argv[++index]);
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isFinite(options.delay) || options.delay < 500) throw new Error("--delay must be at least 500 ms");
  if (!Number.isFinite(options.downloadWait) || options.downloadWait < 32_000) throw new Error("--download-wait must be at least 32000 ms, as requested by Onebox");
  if ((!Number.isFinite(options.limit) && options.limit !== Infinity) || options.limit < 0) throw new Error("--limit must be positive");
  if (!Number.isInteger(options.start) || options.start < 0) throw new Error("--start must be a non-negative integer");
  return options;
}

function usage() {
  console.log(`Download Onebox's publicly available free documents.

Usage:
  node scripts/download-onebox-documents.mjs [options]

Options:
  --output DIR   Destination (default: imports/onebox)
  --delay MS     Delay between requests, minimum 500 (default: 1500)
  --download-wait MS  Wait before generated file request (minimum/default: 32000)
  --start N      Start at sitemap entry N (default: 0)
  --limit N      Process at most N sitemap entries
  --dry-run      Discover pages without submitting download forms
  --help         Show this message

Re-running the same command resumes from manifest.json and does not download
files already recorded there.`);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function decodeHtml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&rsquo;", "’")
    .replaceAll("&lsquo;", "‘")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripHtml(value = "") {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function inputValue(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const input = html.match(new RegExp(`<input[^>]+name=["']${escaped}["'][^>]*>`, "i"))?.[0];
  return input ? decodeHtml(input.match(/value=["']([^"']*)["']/i)?.[1] ?? "") : null;
}

function formAction(html, formId) {
  const form = html.match(new RegExp(`<form[^>]+(?:id|class)=["'][^"']*${formId}[^"']*["'][^>]*>`, "i"))?.[0];
  return form ? decodeHtml(form.match(/action=["']([^"']+)["']/i)?.[1] ?? "") : null;
}

function pageMetadata(html, url) {
  const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? path.basename(new URL(url).pathname));
  const description = decodeHtml(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] ?? "");
  const rawCategory = html.match(/"category"\s*:\s*"((?:\\.|[^"])*)"/i)?.[1] ?? "";
  let category = decodeHtml(rawCategory);
  try {
    category = decodeHtml(JSON.parse(`"${rawCategory}"`));
  } catch {
    // Keep the best-effort HTML-decoded category when embedded JSON is malformed.
  }
  return { title, description, category };
}

function parseCookies(response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

function mergeCookies(...cookieStrings) {
  const values = new Map();
  for (const cookieString of cookieStrings) {
    for (const cookie of cookieString.split(/;\s*/).filter(Boolean)) {
      const separator = cookie.indexOf("=");
      if (separator > 0) values.set(cookie.slice(0, separator), cookie.slice(separator + 1));
    }
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    redirect: options.redirect ?? "follow",
    ...options,
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response;
}

function formBody(fields) {
  return new URLSearchParams(Object.entries(fields).filter(([, value]) => value !== null));
}

function filenameFromResponse(response, title) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename=["']?([^"';]+)["']?/i)?.[1];
  let filename = encoded ? decodeURIComponent(encoded) : plain;
  if (!filename) {
    const types = { "application/pdf": ".pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx", "application/msword": ".doc", "application/vnd.ms-excel": ".xls", "application/zip": ".zip" };
    filename = `${title}${types[(response.headers.get("content-type") ?? "").split(";", 1)[0]] ?? ".bin"}`;
  }
  return filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 180) || "document.bin";
}

async function uniquePath(directory, filename) {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension);
  let candidate = path.join(directory, filename);
  for (let suffix = 2; ; suffix += 1) {
    try {
      await readFile(candidate);
      candidate = path.join(directory, `${stem}-${suffix}${extension}`);
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
}

async function readManifest(filename) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { source: SITE, generatedAt: null, documents: [] };
    throw error;
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function saveManifest(manifest, jsonPath, csvPath) {
  manifest.generatedAt = new Date().toISOString();
  const temporary = `${jsonPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, jsonPath);
  const columns = ["status", "title", "category", "filename", "sha256", "bytes", "sourceUrl", "error"];
  const rows = [columns.map(csvCell).join(","), ...manifest.documents.map((item) => columns.map((column) => csvCell(item[column])).join(","))];
  await writeFile(csvPath, `${rows.join("\n")}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();

  const filesDirectory = path.join(options.output, "files");
  const manifestPath = path.join(options.output, "manifest.json");
  const csvPath = path.join(options.output, "manifest.csv");
  await mkdir(filesDirectory, { recursive: true });

  const robots = await request(`${SITE}/robots.txt`).then((response) => response.text());
  if (/Disallow:\s*\/documents\/?(?:\s|$)/i.test(robots)) throw new Error("Onebox robots.txt disallows /documents; stopping.");

  const sitemap = await request(SITEMAP).then((response) => response.text());
  const discovered = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeHtml(match[1])).filter((url) => url.startsWith(`${SITE}/documents/`));
  const selected = discovered.slice(options.start, options.start + options.limit);
  const manifest = await readManifest(manifestPath);
  const completedUrls = new Set(manifest.documents.filter((item) => ["downloaded", "duplicate", "not_free"].includes(item.status)).map((item) => item.sourceUrl));
  const hashes = new Map(manifest.documents.filter((item) => item.sha256 && item.filename).map((item) => [item.sha256, item.filename]));

  console.log(`Discovered ${discovered.length} document pages; processing ${selected.length}.`);
  let verificationBlocked = false;
  for (let index = 0; index < selected.length; index += 1) {
    const sourceUrl = selected[index];
    if (completedUrls.has(sourceUrl)) {
      console.log(`[${index + 1}/${selected.length}] already processed: ${sourceUrl}`);
      continue;
    }

    let record = { sourceUrl, status: "error", title: "", description: "", category: "", filename: "", sha256: "", bytes: 0, error: "" };
    try {
      await sleep(options.delay);
      const pageResponse = await request(sourceUrl);
      const pageHtml = await pageResponse.text();
      let cookies = parseCookies(pageResponse);
      Object.assign(record, pageMetadata(pageHtml, sourceUrl));
      const product = inputValue(pageHtml, "somdn_product");
      const downloadKey = inputValue(pageHtml, "somdn_download_key");
      const firstAction = formAction(pageHtml, "somdn-download-form");
      if (!product || !downloadKey || !firstAction) {
        record.status = "not_free";
        console.log(`[${index + 1}/${selected.length}] no public free-download form: ${record.title}`);
      } else if (options.dryRun) {
        record.status = "discovered";
        console.log(`[${index + 1}/${selected.length}] free document: ${record.title}`);
      } else {
        await sleep(options.delay);
        const redirectResponse = await request(new URL(firstAction, sourceUrl), {
          method: "POST",
          redirect: "follow",
          headers: { referer: sourceUrl, cookie: cookies, "content-type": "application/x-www-form-urlencoded" },
          body: formBody({ action: "somdn_download_single", somdn_product: product, somdn_download_key: downloadKey }),
        });
        const redirectHtml = await redirectResponse.text();
        cookies = mergeCookies(cookies, parseCookies(redirectResponse));
        const redirectAction = formAction(redirectHtml, "somdn_download_redirect_form");
        const fieldNames = ["somdn_rrtdid", "somdn_rrdkey", "somdn_rrskey", "somdn_rrpkey", "somdn_rrukey", "somdn_rrtype", "somdn_rrpost", "somdn_download_key"];
        const fields = Object.fromEntries(fieldNames.map((name) => [name, inputValue(redirectHtml, name)]));
        if (!redirectAction || Object.values(fields).some((value) => value === null)) {
          const responseTitle = stripHtml(redirectHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "untitled response");
          const dailyLimit = /limite quotidienne de téléchargement est dépassée|essayer après 24h/i.test(redirectHtml);
          const challenge = /<title[^>]*>\s*(?:just a moment|verifying that you are not a robot)/i.test(redirectHtml);
          if (dailyLimit) throw new Error("DAILY_LIMIT: Onebox daily download limit exceeded; retry after 24 hours");
          throw new Error(`Download redirect form was not returned (${challenge ? "bot verification" : responseTitle}; final URL: ${redirectResponse.url})`);
        }

        await sleep(options.downloadWait);
        const fileResponse = await request(new URL(redirectAction, sourceUrl), {
          method: "POST",
          redirect: "follow",
          headers: { referer: redirectResponse.url, cookie: cookies, "content-type": "application/x-www-form-urlencoded" },
          body: formBody(fields),
        });
        const contentType = fileResponse.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) throw new Error("Expected a file but received HTML (possibly a bot challenge or expired form)");
        const bytes = Buffer.from(await fileResponse.arrayBuffer());
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        record.sha256 = sha256;
        record.bytes = bytes.length;
        if (hashes.has(sha256)) {
          record.status = "duplicate";
          record.filename = hashes.get(sha256);
          console.log(`[${index + 1}/${selected.length}] duplicate: ${record.title}`);
        } else {
          const destination = await uniquePath(filesDirectory, filenameFromResponse(fileResponse, record.title));
          const partial = `${destination}.part`;
          await writeFile(partial, bytes);
          await rename(partial, destination);
          record.status = "downloaded";
          record.filename = path.relative(options.output, destination);
          hashes.set(sha256, record.filename);
          console.log(`[${index + 1}/${selected.length}] downloaded: ${record.filename}`);
        }
      }
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      verificationBlocked = /bot verification|DAILY_LIMIT/i.test(record.error);
      console.error(`[${index + 1}/${selected.length}] failed: ${sourceUrl} — ${record.error}`);
    }
    manifest.documents = manifest.documents.filter((item) => item.sourceUrl !== sourceUrl);
    manifest.documents.push(record);
    await saveManifest(manifest, manifestPath, csvPath);
    if (verificationBlocked) {
      console.error(record.error.includes("DAILY_LIMIT")
        ? "Onebox's daily download limit has been reached. Stopping; resume this command after 24 hours."
        : "Onebox requested browser verification. Stopping; retry later or use an interactive browser session.");
      break;
    }
  }

  const counts = manifest.documents.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
  console.log("Finished:", counts);
  console.log(`Files and manifests: ${options.output}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
