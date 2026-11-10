import { chromium, webkit } from "@playwright/test";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import http from "node:http";
const server = http.createServer((req, res) => {
  const name=decodeURIComponent(req.url.split('?')[0]).slice(1);
  if(/^_places_earth_v1_\d+_\d+_\d+\.jpg$/.test(name)){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync('out/places/media/'+name));return}
  res.setHeader("Content-Type", "text/html; charset=utf-8");res.end(fs.readFileSync("out/places/preview.html"));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = "http://127.0.0.1:" + server.address().port;
process.on("exit", () => server.close());
const clients = (process.env.PLACES_BROWSERS || "chromium,webkit").split(",");
if (clients.some(name => !["chromium", "webkit"].includes(name))) throw Error("Unknown PLACES_BROWSERS entry");
for (const type of [chromium, webkit].filter(type => clients.includes(type.name()))) {
  let browser;
  try {
    browser = await type.launch({ executablePath: process.env[type === chromium ? "PLACES_CHROMIUM" : "PLACES_WEBKIT"] || void 0, args: type === chromium ? ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] : [] });
  } catch (e) {
    console.log(type.name(), "launch failed", e.message);
    process.exitCode = 1;
    continue;
  }
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];let remoteTiles=0;
    await page.route('**/services.arcgisonline.com/**',route=>{remoteTiles++;return route.abort()});
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("pageerror", e.message);
    });
    page.on("console", (m) => {
      if (m.type() === "error") console.log(m.text().slice(0, 200));
    });
    await page.goto(url);
    await page.waitForSelector("[data-ready=true]", { timeout: 6e4 });
    const check = async (expr) => {
      if (!await page.evaluate(expr)) throw Error(expr);
    };
    await check(() => window.__places.map.getProjection().type === "globe");
    await check(() => window.__places.prefs.borders === false);
    await page.locator("[data-action=settings]").first().click();
    await page.locator("[data-pref=borders]").check();
    await page.locator("[data-pref=tolerance]").fill("75");
    await page.locator("[data-pref=tolerance]").dispatchEvent("change");
    await check(() => window.__places.map.getLayoutProperty("borders", "visibility") === "visible");
    await page.locator(".settings [data-action=settings]").click();
    // A second click at the same point removes the pin; moving it must not clear it.
    const canvas=page.locator('.maplibregl-canvas');const box=await canvas.boundingBox();
    await page.mouse.click(box.x+box.width*.55,box.y+box.height*.45);
    await check(()=>!!window.__places.attempt.guess);
    await page.locator('.place-pin').click();await check(()=>window.__places.attempt.guess===null&&document.querySelectorAll('.place-pin').length===0);
    await page.mouse.dblclick(box.x+box.width*.55,box.y+box.height*.45);await check(()=>window.__places.attempt.guess===null);
    await page.locator("[data-action=pin]").click();
    await check(() => !!window.__places.attempt.guess);
    await page.evaluate(() => window.__places.setGuess([-100, 40]));
    const camera = await page.evaluate(() => window.__places.map.getCenter().toArray());
    await page.locator("#reveal").click();
    await page.waitForSelector("[data-ready=true]");
    await check(() => window.__places.tolerance() === 75);
    await check(() => document.querySelector(".result").textContent.includes("away"));
    await page.waitForFunction(()=>!window.__places.map.isMoving());
    await check(()=>!!window.__places.map.getLayer('comparison-line'));
    await check(()=>document.querySelectorAll('.place-pin').length===2);
    await check(()=>window.__places.attempt.guess[0]===-100);
    await check(()=>{const m=window.__places.map;return [[-100,40],[-122.416389,37.7775]].every(p=>{const q=m.project(p);return q.x>20&&q.y>20&&q.x<m.getCanvas().clientWidth-20&&q.y<m.getCanvas().clientHeight-20})});
    await page.evaluate(()=>window.__places.map.jumpTo({center:[10,20],zoom:1}));
    await check(()=>document.querySelectorAll('.place-pin').length===2&&window.__places.attempt.guess[0]===-100);
    await page.getByRole('button',{name:'Fit both ↗'}).click();await page.waitForFunction(()=>!window.__places.map.isMoving());
    if(remoteTiles)throw Error('Offline mode contacted online tile server');
    const rb=await page.locator('.result').boundingBox();await page.screenshot({path:'/tmp/places-offline-comparison-'+width+'.png',clip:{x:0,y:0,width,height:Math.ceil(rb.y+rb.height+12)}});
    await page.locator(".thumbnails button").nth(1).click();
    if (await page.locator("[data-hero]").getAttribute("alt") !== "Second gallery sample") throw Error("Gallery");
    await page.locator("[data-hero]").click();
    await page.waitForSelector(".agv");
    await page.keyboard.press("Escape");
    await page.screenshot({ path: "/tmp/places-" + type.name() + "-" + width + ".png", fullPage: true });
    await page.locator("#next").click();
    await page.waitForSelector("[data-ready=true]");
    await check(() => window.__places.attempt.guess === null);
    await check(() => window.__places.prefs.borders === true);
    const rect = await page.locator(".globe").boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 70, rect.y + rect.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    await check(() => window.__places.attempt.guess === null);
    await check(() => Math.abs(window.PlacesMath.distance([179, 0], [-179, 0]) - 222.38985) < 0.01);
    if (errors.length) throw Error(errors.join("\n"));
    // Reveal during a camera motion with no explicit pin: capture the live crosshair,
    // not the previous moveend position, and freeze it while the answer camera moves.
    await page.evaluate(()=>{window.__places.map.stop();document.querySelector('#next').click()});await page.waitForSelector('[data-ready=true]');
    await page.evaluate(()=>window.__places.map.jumpTo({center:[120,30],zoom:2}));
    await page.evaluate(()=>window.__places.map.easeTo({center:[100,45],duration:2000}));await page.waitForTimeout(120);
    await page.locator('#reveal').click();await page.waitForSelector('[data-ready=true]');
    await check(()=>window.__places.attempt.implicit===true&&window.__places.attempt.guess!==null);
    const implicit=await page.evaluate(()=>window.__places.attempt.guess.slice());
    await page.waitForFunction(()=>!window.__places.map.isMoving());
    await page.evaluate(()=>window.__places.map.jumpTo({center:[0,0],zoom:1}));
    if(JSON.stringify(implicit)!==JSON.stringify(await page.evaluate(()=>window.__places.attempt.guess)))throw Error('Implicit guess changed with answer camera');
    const overlay=await page.locator('.result').boundingBox(),mapBox=await page.locator('.globe-wrap').boundingBox();
    if(overlay.y<mapBox.y||overlay.y+overlay.height>mapBox.y+mapBox.height)throw Error('Distance outside map');
    if (width === 375) {
      for(const [target,guess] of [[[179,10],[-179,12]],[[30,72],[-20,70]],[[10,0],[170,0]],[[-122.416389,37.7775],[-122.4,37.79]]]){
        await page.evaluate(([t,g])=>{fixtures[0]['Coordinates']=t[1]+', '+t[0];fixtures[0]['Tolerance km']='';document.querySelector('#next').click()},[target,guess]);
        await page.waitForSelector('[data-ready=true]');await page.evaluate(g=>window.__places.setGuess(g),guess);await page.locator('#reveal').click();await page.waitForSelector('[data-ready=true]');await page.waitForFunction(()=>!window.__places.map.isMoving());
        const framed=await page.evaluate(ps=>{const m=window.__places.map;return ps.map(p=>{const q=m.project(p);return [q.x,q.y,m.getCanvas().clientWidth,m.getCanvas().clientHeight]})},[target,guess]);
        if(!framed.every(([x,y,w,h])=>x>=10&&y>=10&&x<=w-10&&y<=h-10))throw Error('Comparison framing '+JSON.stringify({target,guess,framed}));
        await check(()=>window.PlacesMath.routeBetween([179,10],[-179,12]).length===97);
      }
      await page.evaluate(()=>{fixtures[0]['Coordinates']='37.7775, -122.416389'});

      await page.evaluate(() => {
        fixtures[0]["Tolerance km"] = "3.5";
        fixtures[0]["Wikipedia URL"] = "https://en.wikipedia.org/wiki/San_Francisco";
        document.querySelector("#next").click();
      });
      await page.waitForSelector("[data-ready=true]");
      await check(() => window.__places.tolerance() === 3.5 && window.__places.prefs.tolerance === 75);
      await page.locator("#reveal").click();
      await page.waitForSelector("[data-ready=true]");
      await check(() => document.querySelector(".wiki iframe").src === "https://en.wikipedia.org/wiki/San_Francisco");
      await page.locator("[data-action=settings]").first().click();
      await page.locator("[data-pref=wiki]").selectOption("link");
      await check(() => document.querySelector(".wiki iframe").hidden);
      await page.evaluate(() => {
        fixtures[0]["Coordinates"] = "95, 0";
        document.querySelector("#next").click();
      });
      await check(() => document.querySelector(".map-status").textContent.includes("outside"));
    }
    console.log(type.name(), width, "PASS");
    await page.close();
  }
  await browser.close();
}
server.close();
