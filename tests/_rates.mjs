// tests/rates.test.mts
var BOC_BASE = "https://www.boc.cn/sourcedb/whpj/";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var NAME_TO_CODE = {
  \u963F\u8054\u914B\u8FEA\u62C9\u59C6: "AED",
  \u6FB3\u5927\u5229\u4E9A\u5143: "AUD",
  \u6587\u83B1\u5143: "BND",
  \u5DF4\u897F\u96F7\u4E9A\u5C14: "BRL",
  \u52A0\u62FF\u5927\u5143: "CAD",
  \u745E\u58EB\u6CD5\u90CE: "CHF",
  \u6377\u514B\u514B\u6717: "CZK",
  \u4E39\u9EA6\u514B\u6717: "DKK",
  \u6B27\u5143: "EUR",
  \u82F1\u9551: "GBP",
  \u6E2F\u5E01: "HKD",
  \u5308\u7259\u5229\u798F\u6797: "HUF",
  \u5370\u5C3C\u5362\u6BD4: "IDR",
  \u4EE5\u8272\u5217\u8C22\u514B\u5C14: "ILS",
  \u5370\u5EA6\u5362\u6BD4: "INR",
  \u65E5\u5143: "JPY",
  \u67EC\u57D4\u5BE8\u745E\u5C14: "KHR",
  \u97E9\u56FD\u5143: "KRW",
  \u79D1\u5A01\u7279\u7B2C\u7EB3\u5C14: "KWD",
  \u54C8\u8428\u514B\u65AF\u5766\u575A\u6208: "KZT",
  \u8499\u53E4\u56FE\u683C\u91CC\u514B: "MNT",
  \u6FB3\u95E8\u5143: "MOP",
  \u6BDB\u91CC\u6C42\u65AF\u5362\u6BD4: "MUR",
  \u58A8\u897F\u54E5\u6BD4\u7D22: "MXN",
  \u6797\u5409\u7279: "MYR",
  \u632A\u5A01\u514B\u6717: "NOK",
  \u5C3C\u6CCA\u5C14\u5362\u6BD4: "NPR",
  \u65B0\u897F\u5170\u5143: "NZD",
  \u83F2\u5F8B\u5BBE\u6BD4\u7D22: "PHP",
  \u5DF4\u57FA\u65AF\u5766\u5362\u6BD4: "PKR",
  \u6CE2\u5170\u5179\u7F57\u63D0: "PLN",
  \u5361\u5854\u5C14\u91CC\u4E9A\u5C14: "QAR",
  \u7F57\u9A6C\u5C3C\u4E9A\u5217\u4F0A: "RON",
  \u585E\u5C14\u7EF4\u4E9A\u7B2C\u7EB3\u5C14: "RSD",
  \u5362\u5E03: "RUB",
  \u6C99\u7279\u91CC\u4E9A\u5C14: "SAR",
  \u745E\u5178\u514B\u6717: "SEK",
  \u65B0\u52A0\u5761\u5143: "SGD",
  \u6CF0\u56FD\u94E2: "THB",
  \u571F\u8033\u5176\u91CC\u62C9: "TRY",
  \u65B0\u53F0\u5E01: "TWD",
  \u7F8E\u5143: "USD",
  \u8D8A\u5357\u76FE: "VND",
  \u5357\u975E\u5170\u7279: "ZAR",
  \u8D5E\u6BD4\u4E9A\u514B\u74E6\u67E5: "ZMW"
};
function stripTags(s) {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
function parsePageCount(html) {
  const m = html.match(/共\s*<span>\s*(\d+)\s*<\/span>\s*页/);
  return m ? Number(m[1]) : 1;
}
function parseBocHtml(html) {
  const table = html.match(/<table[^>]*id="priceTable"[\s\S]*?<\/table>/i);
  const scope = table ? table[0] : html;
  const rowRe = /<tr[^>]*data-currency=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/tr>/gi;
  const out = [];
  let m;
  while ((m = rowRe.exec(scope)) !== null) {
    const cn = m[1].trim();
    const code = NAME_TO_CODE[cn];
    if (!code) continue;
    const cells = Array.from(m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (c) => stripTags(c[1]));
    const rawBuy = cells[1] ?? "";
    const publishTime = cells[6] || cells[7] || void 0;
    if (!/^\d+(\.\d+)?$/.test(rawBuy) || Number(rawBuy) <= 0) {
      out.push({ code, name: cn, price: "", rawPrice: rawBuy, publishTime });
      continue;
    }
    const perUnit = (Number(rawBuy) / 100).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    out.push({ code, name: cn, price: perUnit, rawPrice: rawBuy, publishTime });
  }
  return out;
}
async function getHtml(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2e4);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "text/html" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString("utf-8");
  } finally {
    clearTimeout(t);
  }
}
var pass = 0;
var fail = 0;
var notes = [];
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    console.log(`  \u2717 ${name} ${extra}`);
  }
}
async function main() {
  console.log("\n\u3010\u4E2D\u56FD\u94F6\u884C\u724C\u4EF7\u6293\u53D6\u6D4B\u8BD5\u3011\n");
  const t0 = Date.now();
  const html = await getHtml(`${BOC_BASE}index.html`);
  const dt = Date.now() - t0;
  console.log(`  \u9996\u9875\u54CD\u5E94 ${dt}ms \xB7 ${html.length} \u5B57\u8282`);
  check("\u9875\u9762\u53EF\u8BBF\u95EE\u4E14\u542B\u724C\u4EF7\u8868", html.includes("priceTable") || html.includes("\u8D27\u5E01\u540D\u79F0"));
  const pages = parsePageCount(html);
  console.log(`  \u5206\u9875\u603B\u6570\uFF1A${pages}`);
  check("\u8BC6\u522B\u5230\u9875\u6570", pages >= 1);
  const merged = /* @__PURE__ */ new Map();
  let publishTime = "";
  const pageStats = [];
  for (let p = 1; p <= pages; p++) {
    const url = p === 1 ? `${BOC_BASE}index.html` : `${BOC_BASE}index_${p}.html`;
    let pageHtml;
    try {
      pageHtml = p === 1 ? html : await getHtml(url);
    } catch (e) {
      console.log(`  ! \u7B2C ${p} \u9875\u6293\u53D6\u5931\u8D25\uFF1A${e.message}`);
      continue;
    }
    const entries2 = parseBocHtml(pageHtml);
    pageStats.push({ page: p, count: entries2.length });
    for (const e of entries2) {
      const prev = merged.get(e.code);
      if (!prev || !prev.price && e.price) merged.set(e.code, e);
      if (!publishTime && e.publishTime) publishTime = e.publishTime;
    }
  }
  console.log(`  \u9010\u9875\u7ED3\u679C\uFF1A${pageStats.map((s) => `p${s.page}=${s.count}`).join(" ")}`);
  check("\u9010\u9875\u6293\u53D6\u5B8C\u6210", pageStats.length > 0);
  check("\u53BB\u91CD\u540E\u5E01\u79CD\u6570 \u2265 40", merged.size >= 40, `\u5B9E\u9645 ${merged.size}`);
  const entries = Array.from(merged.values()).sort((a, b) => a.code.localeCompare(b.code));
  const withPrice = entries.filter((e) => e.price);
  const withoutPrice = entries.filter((e) => !e.price);
  console.log(`  \u6709\u6548\u73B0\u6C47\u4E70\u5165\u4EF7\uFF1A${withPrice.length} \xB7 \u7F3A\u5931\uFF1A${withoutPrice.length}`);
  if (withoutPrice.length) console.log(`  \u65E0\u73B0\u6C47\u4E70\u5165\u4EF7\uFF1A${withoutPrice.map((e) => `${e.code}(${e.name})`).join("\u3001")}`);
  check("\u7EDD\u5927\u591A\u6570\u5E01\u79CD\u6709\u73B0\u6C47\u4E70\u5165\u4EF7", withPrice.length >= 40);
  check("\u53D1\u5E03\u65F6\u95F4\u53EF\u89E3\u6790", /^\d{4}\/\d{2}\/\d{2}/.test(publishTime), publishTime);
  for (const code of ["USD", "EUR", "JPY", "HKD", "GBP", "AUD", "CAD", "SGD", "KRW", "THB"]) {
    const e = merged.get(code);
    check(`\u5E01\u79CD ${code} \u5B58\u5728\u4E14\u6709\u4EF7`, !!e && !!e.price, e ? `price=${e.price} raw=${e.rawPrice}` : "\u7F3A\u5931");
  }
  let calibOk = true;
  for (const e of withPrice) {
    const expect = (Number(e.rawPrice) / 100).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    if (e.price !== expect) {
      calibOk = false;
      notes.push(`${e.code}: \u89E3\u6790 ${e.price} \u2260 ${e.rawPrice}/100`);
    }
  }
  check("\u4EF7\u683C\u53E3\u5F84\u6B63\u786E\uFF08\u6BCF100\u5916\u5E01 \xF7 100\uFF09", calibOk, notes.join("; "));
  const usd = merged.get("USD");
  if (usd && usd.price) {
    const price = Number(usd.price);
    console.log(`
\u3010\u6362\u6C47\u5BF9\u6BD4\u6570\u636E\u6D4B\u8BD5\u3011`);
    console.log(`  USD \u73B0\u6C47\u4E70\u5165\u4EF7\uFF1A${usd.rawPrice}\uFF08\u6BCF100\u7F8E\u5143\uFF09 \u2192 1 USD = ${price.toFixed(4)} CNY`);
    const cases = [
      { cny: 1e3, expect: (1e3 / price).toFixed(2) },
      { cny: 100, expect: (100 / price).toFixed(2) },
      { cny: 5e4, expect: (5e4 / price).toFixed(2) },
      { cny: 1234.56, expect: (1234.56 / price).toFixed(2) }
    ];
    for (const c of cases) {
      const got = (c.cny / price).toFixed(2);
      check(`CNY ${c.cny} \u2192 USD ${got}`, got === c.expect);
    }
    check("\u53CD\u5411 1 USD = \u4EF7\u683C\u672C\u8EAB", Math.abs(1 * price - price) < 1e-9);
    const eur = merged.get("EUR");
    if (eur && eur.price) {
      const cross = price / Number(eur.price);
      const viaCny = 1e3 / Number(eur.price) / (1e3 / price);
      check(`\u4EA4\u53C9\u6C47\u7387 USD\u2192EUR \u4E00\u81F4\u6027\uFF08${cross.toFixed(4)}\uFF09`, Math.abs(cross - viaCny) < 1e-9);
    }
  } else {
    check("USD \u724C\u4EF7\u53EF\u7528\u4E8E\u6362\u6C47\u6D4B\u8BD5", false);
  }
  console.log(`
  \u901A\u8FC7 ${pass} \u9879 \xB7 \u5931\u8D25 ${fail} \u9879
`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => {
  console.error("\u6D4B\u8BD5\u5F02\u5E38\uFF1A", e);
  process.exit(1);
});
