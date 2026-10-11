import { expect, test } from "@playwright/test";

const token=`v1.${"A".repeat(43)}`;
const lineup = { status:"ready",eventName:"Friday Guild League",eventType:"League",version:4,publishedAt:"2026-10-11T12:00:00Z",page:0,pageSize:12,totalCards:2,matchedCards:2,
  cards:[{ordinal:1,area:"Northern Arena",team:"Vanguard",party:"Party One",slots:[
    {name:"Seat 1",roleLabel:"Support",ign:"Moonlight",className:"High Priest",characterRole:"Healer"},
    {name:"Seat 2",roleLabel:"Damage",ign:null,className:null,characterRole:null}]},
  {ordinal:2,area:"Southern Arena",team:"Sentinels",party:"Party Two",slots:[
    {name:"Seat 1",roleLabel:"Support",ign:"Moonlight",className:"Paladin",characterRole:"Tank"}]}] };

test("fragment cleanup, safe shell, accessible assignment search and responsive cards",async({page,context},testInfo)=>{
  const requests: string[]=[]; page.on("request",r=>requests.push(r.url()));
  const logs: string[]=[]; page.on("console",m=>logs.push(m.text()));
  // A cookie-bearing visitor uses the same public path without an Auth round trip.
  await context.addCookies([{name:"synthetic-member",value:"not-an-auth-credential",domain:"127.0.0.1",path:"/"}]);
  await page.route("**/api/share/event",async route=>{
    expect(route.request().method()).toBe("POST"); expect(route.request().url()).not.toContain(token);
    const body=route.request().postDataJSON();expect(body.token).toBe(token);
    await route.fulfill({status:200,json:lineup,headers:{"Cache-Control":"no-store"}});
  });
  const response=await page.goto(`/share/event#token=${token}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(await response?.text()).not.toContain(token);
  await expect(page.getByRole("heading",{name:"Friday Guild League"})).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");expect(await page.content()).not.toContain(token);
  const search=page.getByRole("searchbox",{name:"Find your IGN"}); await search.focus(); await expect(search).toBeFocused();
  await search.fill("Moonlight"); await search.press("Enter");
  await expect(page.getByText("Matching assignment",{exact:true})).toHaveCount(2);
  await expect(page.getByRole("status")).toBeFocused();
  expect(await page.getByRole("button",{name:"Find assignment"}).evaluate(el=>getComputedStyle(el).color)).toBe("rgb(7, 16, 31)");
  await expect(page.getByRole("heading",{name:"Party One"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Party Two"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);
  expect(requests.every(url=>!url.includes(token))).toBe(true);expect(logs.join("\n")).not.toContain(token);
  await page.emulateMedia({reducedMotion:"reduce"});
  const durations=await page.getByRole("button",{name:"Find assignment"}).evaluate(el=>getComputedStyle(el).transitionDuration);
  // The existing global reduced-motion rule uses 0.01ms (not an exact zero).
  expect(durations.split(",").every(value=>parseFloat(value)<=0.00001)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("published-lineup.png"),fullPage:true});
});

test("anonymous visitor, generic Discord metadata, invalid and unavailable states",async({page})=>{
  await page.goto("/share/event");await expect(page.getByRole("heading",{name:"Your lineup starts with a shared link"})).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content","Guild Organizer • Event lineup");
  await page.goto("/share/event#token=invalid");await expect(page.getByRole("heading",{name:"This link is incomplete"})).toBeVisible();expect(new URL(page.url()).hash).toBe("");
  await page.route("**/api/share/event",route=>route.fulfill({status:404,json:{status:"unavailable"}}));
  await page.goto(`/share/event#token=${token}`);await expect(page.getByRole("heading",{name:"This lineup is unavailable"})).toBeVisible();
});

test("actual production API stays closed without resolver and admission configuration", async ({ request }) => {
  const response = await request.post("/api/share/event", { data: { malformed: true } });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const get = await request.get("/api/share/event"); expect(get.status()).toBe(405);
});
