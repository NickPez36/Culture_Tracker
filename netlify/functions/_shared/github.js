// netlify/functions/_shared/github.js
// Minimal helpers for GitHub file read/write and CSV handling.

const OWNER = process.env.GITHUB_USER;     // e.g., "NickPez36"
const REPO  = process.env.GITHUB_REPO;     // e.g., "Culture_Tracker"
const PATH  = process.env.CSV_PATH || "data.csv";
const TOKEN = process.env.GITHUB_TOKEN;    // PAT with repo scope

const API_BASE = "https://api.github.com";

function assertEnv() {
  if (!OWNER || !REPO || !TOKEN) {
    throw new Error("Missing required env vars: GITHUB_USER, GITHUB_REPO, GITHUB_TOKEN");
  }
}

async function ghFetch(url, init = {}) {
  assertEnv();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `token ${TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "culture-tracker-netlify-fn",
      ...(init.headers || {})
    }
  });
  return res;
}

async function getFile() {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(PATH)}`;
  const res = await ghFetch(url);
  if (res.status === 404) return null; // not found
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content || "", "base64").toString("utf8");
  return { content, sha: json.sha };
}

async function putFile(newContent, sha, message) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(PATH)}`;
  const body = {
    message: message || `Update ${PATH}`,
    content: Buffer.from(newContent, "utf8").toString("base64"),
    sha
  };
  const res = await ghFetch(url, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub PUT failed: ${res.status} ${txt}`);
  }
  return res.json();
}

function toSydneyYMD(date = new Date()) {
  // Using en-CA yields YYYY-MM-DD reliably
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  return ymd; // "YYYY-MM-DD"
}

function toSydneyTime(date = new Date()) {
  // HH:mm:ss 24h
  const parts = date.toLocaleTimeString("en-GB", {
    timeZone: "Australia/Sydney",
    hour12: false
  });
  return parts; // "HH:MM:SS"
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const [header, ...rows] = lines;
  // header expected: date,time,name,rating
  return rows.map(line => {
    const cols = line.split(","); // names have no commas by design
    return { date: cols[0], time: cols[1], name: cols[2], rating: Number(cols[3]) };
  });
}

function toCsv(rows) {
  const head = "date,time,name,rating";
  const body = rows.map(r => [r.date, r.time, r.name, r.rating].join(",")).join("\n");
  return `${head}\n${body}\n`;
}

async function ensureCsv() {
  const file = await getFile();
  if (file && file.content.trim()) return file; // exists and non-empty
  const content = "date,time,name,rating\n";
  const put = await putFile(content, file ? file.sha : undefined, "Initialize CSV");
  return { content, sha: put.content.sha };
}

module.exports = {
  getFile, putFile, ensureCsv, parseCsv, toCsv,
  toSydneyYMD, toSydneyTime
};
