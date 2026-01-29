import fs from "node:fs/promises";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_TABLE;
const VIEW = process.env.AIRTABLE_VIEW; // optioneel
const OUT_FILE = process.env.OUT_FILE || "data/DEF-JobAt.json";

if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE) {
  throw new Error("Missing env vars: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE");
}

function cdata(html = "") {
  return `<![CDATA[${html}]]>`;
}

function withUtm(url = "") {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=jobat&utm_medium=affiliate`;
}

async function fetchAllRecords() {
  const records = [];
  let offset;

  while (true) {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (VIEW) params.set("view", VIEW);
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Airtable error ${res.status}: ${txt}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    if (!data.offset) break;
    offset = data.offset;
  }

  return records;
}

function mapRecord(r) {
  const f = r.fields || {};

  // ✅ PAS DIT AAN aan jouw Airtable veldnamen
  const web = withUtm(f.url || "");

  return {
    internal_id: f.internal_id || r.id,
    title: f.JSON_title || "",
    language: f.JSON_language || "",

    description: cdata(f.JSON_description || ""),
    description_program: cdata(f.JSON_description_program || ""),
    description_extrainfo: cdata(f.description_extrainfo || ""),


  };
}

const records = await fetchAllRecords();
const items = records.map(mapRecord);

await fs.mkdir("data", { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2), "utf8");

console.log(`Wrote ${items.length} items to ${OUT_FILE}`);
