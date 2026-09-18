const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const cards = [
  ...Array.from({ length: 11 }, (_, value) => ({ type: "number", value, id: `n-${value}` })),
  "draw1", "draw2", "pass", "reverse", "skip", "eq21", "eq10", "eq0", "redeal", "bomb"
].map((card) => typeof card === "string" ? { type: "wild", kind: card, id: card } : card);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });
  await page.click("button[value='start']");
  await page.click("button[value='start-turn']");
  await page.evaluate((cardsToRender) => {
    document.body.innerHTML = `
      <main style="padding:16px;background:#141414;min-height:100vh">
        <section class="hand" id="fitHand" style="width:574px;grid-template-columns:repeat(auto-fill,minmax(4.6rem,1fr));"></section>
        <section id="fitDiscards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:12px;margin-top:16px"></section>
      </main>
    `;
    const hand = document.querySelector("#fitHand");
    const discards = document.querySelector("#fitDiscards");
    cardsToRender.forEach((card) => {
      hand.append(cardElement(card, true));
      const wrap = document.createElement("div");
      wrap.className = "pile discard-pile";
      wrap.innerHTML = "<span>Poistopakka</span><div class=\"discardSlot\"></div>";
      wrap.querySelector(".discardSlot").replaceChildren(cardElement(card, false));
      discards.append(wrap);
    });
  }, cards);

  await page.screenshot({ path: "card-fit-gallery.png", fullPage: true });
  const failures = await page.evaluate(() => {
    const parts = [...document.querySelectorAll(".card-type, .card-value, .card-desc")];
    return parts
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent,
          cls: el.className,
          width: r.width,
          height: r.height,
          scrollWidth: el.scrollWidth,
          scrollHeight: el.scrollHeight
        };
      })
      .filter((x) => x.scrollWidth > Math.ceil(x.width) + 1);
  });
  await browser.close();
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log("card fit ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
