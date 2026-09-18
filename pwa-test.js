const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);

  const registration = await page.evaluate(async () => {
    const current = await navigator.serviceWorker.getRegistration();
    return {
      active: Boolean(current?.active),
      scope: current?.scope ?? ""
    };
  });

  if (!registration.active) {
    throw new Error(`Service worker did not activate: ${JSON.stringify(registration)}`);
  }

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  const offlineState = {
    title: await page.title(),
    setupOpen: await page.locator("#setupDialog").getAttribute("open") !== null,
    stylesheetLoaded: await page.locator("link[rel='stylesheet']").evaluate((link) => Boolean(link.sheet))
  };

  if (offlineState.title !== "5Alive" || !offlineState.setupOpen || !offlineState.stylesheetLoaded) {
    throw new Error(`Offline reload failed: ${JSON.stringify(offlineState)}`);
  }

  await browser.close();
  console.log("pwa offline ok", { registration, offlineState });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
