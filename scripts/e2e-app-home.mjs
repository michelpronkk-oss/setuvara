import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const names = { personal: "Personal", event: "Event", business: "Business" };
const screenshots = ".next/home-qa";

async function ready(page) {
  await page.getByRole("heading", { name: "Your Setuvara", exact: true }).waitFor();
  await page.getByRole("link", { name: /Open your Passport\./ }).waitFor();
  await page.getByRole("heading", { name: /^(People you met|Meet your first people)$/ }).waitFor();
}

function picker(page) { return page.getByRole("radiogroup", { name: "Choose a Mode", exact: true }).filter({ visible: true }); }
function shareButton(page) { return page.getByRole("button", { name: /^Share (Personal|Event|Business)( Mode)?$/ }).filter({ visible: true }); }

async function fit(page, label) {
  const box = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(box.scroll <= box.width + 1, `${label}: horizontal overflow ${box.scroll} > ${box.width}`);
}

async function openMenu(page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  const menu = page.getByRole("menu", { name: "Account", exact: true });
  await menu.waitFor();
  assert(await menu.getByRole("menuitem").first().evaluate((node) => node === document.activeElement), "Account menu must receive focus");
  await page.keyboard.press("End");
  assert(await menu.getByRole("menuitem", { name: "Sign out" }).evaluate((node) => node === document.activeElement));
  await page.keyboard.press("Home");
  return menu;
}

async function closeMenu(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "detached" });
  assert(await page.getByRole("button", { name: "Account menu" }).evaluate((node) => node === document.activeElement));
}

export async function validateFreshHome(page, appUrl) {
  await mkdir(screenshots, { recursive: true });
  await page.goto(`${appUrl}/app`);
  await ready(page);
  await page.getByRole("heading", { name: "Meet your first people" }).waitFor();
  await page.getByRole("link", { name: /Open your Passport\. 0 people met\./ }).waitFor();
  const stage = page.getByRole("region", { name: "Personal Mode", exact: true });
  await stage.getByText(/PRIVATE$/).waitFor();
  await stage.getByRole("link", { name: /Add a photo/ }).waitFor();
  assert.equal(await stage.locator("img").count(), 0, "A new account must use the real no-photo state");
  assert.equal(await stage.getByRole("link", { name: "View profile" }).count(), 0);
  const menu = await openMenu(page);
  assert.equal(await menu.getByRole("menuitem", { name: "See plans" }).getAttribute("href"), "/pricing");
  await menu.getByRole("menuitem", { name: "View public profile" }).waitFor();
  await menu.getByRole("menuitem", { name: "Mode settings" }).waitFor();
  await menu.screenshot({ path: `${screenshots}/account-free.png` });
  await closeMenu(page);
  await shareButton(page).click();
  await page.getByRole("dialog").getByText(/Your Setuvara is a draft/).waitFor();
  await page.keyboard.press("Escape");
  assert(await shareButton(page).evaluate((node) => node === document.activeElement), "Mobile Share must regain focus");
  await fit(page, "Fresh Home");
  console.log("PASS Home: fresh account, no photo, unpublished, zero Connections/Passport, Free menu and draft Share");
}

export async function validateHomeWithData({ page, browser, appUrl, owner, ownerId, authenticatedClient, localSql }) {
  const { client } = await authenticatedClient(owner);
  const { data: profile } = await client.from("profiles").select("username,display_name,bio,is_published").eq("id", ownerId).single();
  const { data: modes } = await client.from("profile_modes").select("id,slug,is_enabled,image_path,settings").eq("profile_id", ownerId);
  assert(profile && modes?.length === 3);
  const { data: overview } = await client.rpc("get_passport_overview");
  const { data: connections } = await client.from("connections").select("id").order("created_at", { ascending: false }).limit(5);
  assert(overview.connectionCount >= 50 && connections.length === 5, "Home QA must use progressed real local data");
  const anon = await browser.newContext();
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    // Deliberate mocked portal 503 is checked below; unexpected errors fail QA.
    if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text());
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  await mkdir(screenshots, { recursive: true });
  const subscriptionId = `sub_home${ownerId.replaceAll("-", "")}`;
  try {
    await page.goto(`${appUrl}/app?mode=personal`);
    await ready(page);
    await page.getByRole("heading", { name: "People you met" }).waitFor();
    await page.getByRole("link", { name: new RegExp(`Open your Passport\\. ${overview.connectionCount} people met\\.`) }).waitFor();
    const people = page.getByRole("region", { name: "People you met" });
    assert.equal(await people.locator("li").count(), 5);
    for (const connection of connections) assert.equal(await people.locator(`a[href="/app/connections/${connection.id}"]`).count(), 1);
    const image = page.getByRole("region", { name: "Personal Mode", exact: true }).locator("img");
    await image.waitFor();
    await image.evaluate((img) => img.decode());
    assert(await image.evaluate((img) => img.naturalWidth > 0), "Home photo must load");

    // Actual Mode state, URL precedence, remembered selection and keyboard radios.
    for (const slug of Object.keys(names)) {
      await picker(page).getByRole("radio", { name: new RegExp(names[slug]) }).click();
      await page.getByRole("region", { name: `${names[slug]} Mode`, exact: true }).waitFor();
      const stage = page.getByRole("region", { name: `${names[slug]} Mode`, exact: true });
      const settings = modes.find((mode) => mode.slug === slug).settings;
      const line = slug === "personal" ? profile.bio : slug === "event" ? settings.hereToMeet : settings.description;
      assert(line, "Home QA requires real saved Mode context");
      await stage.getByText(line, { exact: true }).waitFor();
      if (slug !== "personal") assert.equal(await stage.getByText(profile.bio, { exact: true }).count(), 0, "Personal bio must not leak into another Mode");
      assert.equal(await picker(page).getByRole("radio", { checked: true }).getAttribute("data-mode"), slug);
      const href = await page.getByRole("region", { name: `${names[slug]} Mode`, exact: true }).getByRole("link", { name: "View profile" }).getAttribute("href");
      const url = new URL(href);
      assert.equal(url.pathname, `/${profile.username}`);
      assert.equal(url.searchParams.get("mode"), slug === "personal" ? null : slug);
      assert.equal((await anon.request.get(href)).status(), 200);
      await shareButton(page).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: `${names[slug]} Mode` }).waitFor();
      if (slug === "personal") await dialog.screenshot({ path: `${screenshots}/share-desktop.png` });
      await dialog.locator("svg title").filter({ hasText: `${names[slug]} Mode QR code` }).waitFor({ state: "attached" });
      await dialog.getByRole("button", { name: "Copy link" }).click();
      await dialog.getByRole("button", { name: "Copied", exact: true }).waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      const copiedUrl = new URL(copied);
      assert.equal(copiedUrl.pathname, `/${profile.username}`);
      assert.equal(copiedUrl.searchParams.get("mode"), slug === "personal" ? null : slug);
      assert.equal(copiedUrl.searchParams.get("source"), "link");
      copiedUrl.searchParams.set("source", "qr");
      assert.equal((await anon.request.get(copiedUrl.toString())).status(), 200, "QR target must resolve publicly");
      assert.equal(await dialog.getByRole("link", { name: "Full-screen QR and downloads" }).getAttribute("href"), `/app/identity?mode=${slug}&section=share`);
      await page.keyboard.press("Escape");
      assert(await shareButton(page).evaluate((node) => node === document.activeElement));
    }
    await page.goto(`${appUrl}/app`);
    await picker(page).getByRole("radio", { name: /Business/, checked: true }).waitFor();
    await page.reload();
    await picker(page).getByRole("radio", { name: /Business/, checked: true }).waitFor();
    await page.goto(`${appUrl}/app?mode=personal`);
    await picker(page).getByRole("radio", { name: /Personal/, checked: true }).waitFor();
    const personal = picker(page).getByRole("radio", { checked: true });
    await personal.focus(); await page.keyboard.press("ArrowRight");
    await picker(page).getByRole("radio", { name: /Event/, checked: true }).waitFor();
    await page.keyboard.press("End");
    await picker(page).getByRole("radio", { name: /Business/, checked: true }).waitFor();
    await page.keyboard.press("Home");
    await picker(page).getByRole("radio", { name: /Personal/, checked: true }).waitFor();

    // Native share invokes the real browser API boundary; automated OS sheets are not available.
    await page.evaluate(() => { navigator.share = async (data) => { window.__homeShared = data; }; });
    await shareButton(page).click();
    const dialog = page.getByRole("dialog");
    const personalQr = await dialog.locator('svg[role="img"] path').last().getAttribute("d");
    await dialog.getByRole("radio", { name: "Event", exact: true }).click();
    await dialog.getByRole("img", { name: "Event Mode QR code", exact: true }).waitFor();
    assert.notEqual(await dialog.locator('svg[role="img"] path').last().getAttribute("d"), personalQr, "Changing Mode inside Share must change the encoded QR");
    await dialog.getByRole("button", { name: "Share link" }).click();
    const shared = await page.evaluate(() => window.__homeShared);
    assert.equal(new URL(shared.url).searchParams.get("source"), "native_share");
    assert.equal(new URL(shared.url).searchParams.get("mode"), "event");
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    assert(await dialog.getByRole("link", { name: "Full-screen QR and downloads" }).evaluate((node) => node === document.activeElement), "Share focus must wrap backwards");
    await page.keyboard.press("Tab");
    assert(await dialog.getByRole("button", { name: "Close", exact: true }).evaluate((node) => node === document.activeElement));
    await page.keyboard.press("Escape");

    const event = modes.find((mode) => mode.slug === "event");
    assert.ifError((await client.from("profile_modes").update({ is_enabled: false }).eq("id", event.id)).error);
    await page.goto(`${appUrl}/app?mode=event`);
    await page.getByText(/MODE OFF$/).waitFor();
    assert.equal(await page.getByRole("region", { name: "Event Mode", exact: true }).getByRole("link", { name: "View profile" }).count(), 0);
    await shareButton(page).click();
    await page.getByRole("dialog").getByText(/Event Mode is off/).waitFor();
    await page.keyboard.press("Escape");
    assert.equal((await anon.request.get(`${appUrl}/${profile.username}?mode=event`)).status(), 404);
    assert.ifError((await client.from("profile_modes").update({ is_enabled: event.is_enabled }).eq("id", event.id)).error);

    // Database-backed paid states. Fixture IDs never leave the local test database.
    for (const plan of ["plus", "pro"]) {
      const fixture = localSql(`insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,last_provider_event_id,last_provider_event_at,last_sync_started_at) values ('${subscriptionId}','${ownerId}','cus_localhome','pdt_localhome','${plan}','monthly','active','homefixture',now(),now()) on conflict (dodo_subscription_id) do update set plan_code=excluded.plan_code returning plan_code;`);
      assert.equal(fixture[0]?.plan_code, plan);
      await page.goto(`${appUrl}/app?mode=personal`);
      const menu = await openMenu(page);
      await menu.getByRole("img", { name: plan === "plus" ? "Setuvara Plus member" : "Setuvara Pro member", exact: true }).waitFor();
      await menu.screenshot({ path: `${screenshots}/account-${plan}.png` });
      assert.equal(await menu.getByRole("menuitem", { name: "See plans" }).count(), 0);
      // Test safe account UI failure without making provider requests or payments.
      await page.route("**/api/billing/portal", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{}' }));
      await menu.getByRole("menuitem", { name: "Manage", exact: true }).click();
      await menu.getByText("Billing could not open. Try again in a moment.").waitFor();
      await page.unroute("**/api/billing/portal");
      await closeMenu(page);
      const portalFixture = `${appUrl}/__local_home_portal`;
      await page.route(portalFixture, (route) => route.fulfill({ contentType: "text/html", body: "<title>Local portal navigation fixture</title>" }));
      await page.route("**/api/billing/portal", (route) => {
        assert.equal(route.request().method(), "POST");
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ portalUrl: portalFixture }) });
      });
      const reopenedMenu = await openMenu(page);
      await reopenedMenu.getByRole("menuitem", { name: "Manage", exact: true }).click();
      await page.waitForURL(portalFixture);
      await page.unroute("**/api/billing/portal");
      await page.unroute(portalFixture);
    }
    localSql(`delete from public.billing_subscriptions where dodo_subscription_id='${subscriptionId}' returning dodo_subscription_id;`);

    // Long names/usernames and every requested phone/desktop width.
    const longUsername = `home_${ownerId.replaceAll("-", "").slice(0, 19)}`;
    for (const [label, name, username] of [["short", "A", profile.username], ["long", "Alexandria Josephine van der Meer Constantinopolitanou", longUsername], ["unbroken", "Alexandria".repeat(8), longUsername]]) {
      assert.ifError((await client.from("profiles").update({ display_name: name, username }).eq("id", ownerId)).error);
      for (const width of [360, 390, 430, 1280, 1440, 1728, 1920]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
        await page.goto(`${appUrl}/app?mode=personal`);
        await ready(page);
        await fit(page, `Home ${label} ${width}`);
        const nav = page.getByRole("navigation", { name: "Main navigation", exact: true }).filter({ visible: true });
        assert.equal(await nav.getByRole("link").count(), 4);
        await nav.getByRole("link", { name: "Home", exact: true }).waitFor();
        const target = await shareButton(page).boundingBox();
        assert(target && target.height >= 44 && target.width >= 44, "Share touch target");
        const stageBox = await page.getByRole("region", { name: "Personal Mode", exact: true }).boundingBox();
        assert(stageBox.width >= (width < 768 ? width * .9 : width * .45), "Identity must dominate the Home stage");
        const nameBox = await page.getByRole("region", { name: "Personal Mode", exact: true }).getByText(name, { exact: true }).boundingBox();
        assert(nameBox && nameBox.x >= stageBox.x && nameBox.x + nameBox.width <= stageBox.x + stageBox.width + 1, "Name must fit the stage");
        assert(nameBox.y >= stageBox.y + 64 && nameBox.y + nameBox.height <= stageBox.y + stageBox.height, "Name must not overlap the status or escape the stage");
        await shareButton(page).click();
        await fit(page, `Share ${label} ${width}`);
        const panel = await page.getByRole("dialog").boundingBox();
        assert(panel.x >= 0 && panel.x + panel.width <= width + 1);
        if (label === "short" && width === 390) await page.getByRole("dialog").screenshot({ path: `${screenshots}/share-mobile.png` });
        await page.keyboard.press("Escape");
        if (label !== "unbroken") await page.screenshot({ path: `${screenshots}/home-${label}-${width}.png`, fullPage: true });
      }
    }
    assert.deepEqual(errors, [], "Home/account/share must have no browser runtime errors");
    console.log("PASS Home: real People/Passport/photo, three Modes, remembered Mode, disabled Mode, share/copy/native boundary/focus, database-backed Plus/Pro and safe portal error");
    console.log("PASS Home responsive: 360/390/430/1280/1440/1728/1920, short/long/unbroken names, long username, reachable touch controls and no overflow");
  } finally {
    localSql(`delete from public.billing_subscriptions where dodo_subscription_id='${subscriptionId}' returning dodo_subscription_id;`);
    await client.from("profiles").update(profile).eq("id", ownerId);
    for (const mode of modes) await client.from("profile_modes").update({ is_enabled: mode.is_enabled }).eq("id", mode.id);
    page.off("pageerror", onError);
    page.off("console", onConsole);
    await anon.close();
    await client.auth.signOut();
  }
}
