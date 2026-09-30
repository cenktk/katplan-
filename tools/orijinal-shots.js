const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/user/airtable-dashboard/29-09-2026-kat-plani-3d/spec/shots/';
const THREE = '/tmp/claude-0/-home-user-airtable-dashboard/05d84c35-6486-527f-a8e3-900ef6468b02/scratchpad/three/package/';
const wait = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  async function mk(w,h,opts={}) {
    const ctx = await browser.newContext({ viewport:{width:w,height:h}, ...opts });
    await ctx.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => {
      const p = new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/','');
      try { r.fulfill({ body: fs.readFileSync(THREE+p), contentType:'application/javascript' }); } catch(e){ r.fulfill({status:404}); }
    });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type()==='error') console.log('ERR', m.text()); });
    page.on('pageerror', e => console.log('PAGEERR', e.message));
    await page.goto('http://localhost:8765/index.html'); await wait(800);
    return {ctx,page};
  }
  const shot = (page,n) => page.screenshot({path:OUT+n+'.png'});
  const info = {};
  // ---- desktop
  let {ctx,page} = await mk(1440,900);
  await shot(page,'01-2d-varsayilan');
  info.layout = await page.evaluate(()=>{
    const r = s => { const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]; };
    return {header:r('header'),lib:r('aside.lib'),main:r('main'),right:r('aside.right'),footer:r('footer'),brand:r('.brand'),seg:r('#viewSeg'),tools:r('#tools'),layers:r('#layers'),langBtn:r('#langBtn'),fs:r('#fullscreen'),menu:r('.menu summary'),scalebar:r('#scalebar'),item:r('.item'),undo:r('#undo'),
      fontFam:getComputedStyle(document.body).fontFamily, btnH:r('.btn'), tgLib:r('#tgLib'), tgPanel:r('#tgPanel')};
  });
  // select furniture: bed
  const bed = await page.locator('g.furn').first().boundingBox();
  await page.mouse.click(bed.x+bed.width/2, bed.y+bed.height/2); await wait(300);
  await shot(page,'02-mobilya-secili');
  info.fab = await page.evaluate(()=>{const b=document.querySelector('#fab').getBoundingClientRect();return [b.x,b.y,b.width,b.height]});
  // right panel of selected: fine. Deselect
  await page.keyboard.press('Escape');
  // measure tool
  await page.keyboard.press('m'); await wait(200);
  const m = await page.locator('#plan').boundingBox();
  await page.mouse.move(m.x+400,m.y+300); await page.mouse.down(); await page.mouse.move(m.x+600,m.y+330,{steps:5}); await page.mouse.up();
  await page.mouse.click(m.x+500,m.y+500); await page.mouse.move(m.x+700,m.y+520,{steps:5}); await wait(200);
  await shot(page,'03-olcu-araci');
  // demolish
  await page.keyboard.press('Escape'); await page.keyboard.press('x'); await wait(200);
  // click a non-bearing wall: find .wall rects with fill #a7a195
  const w = await page.evaluate(()=>{const els=[...document.querySelectorAll('.wall')].filter(e=>e.getAttribute('fill')==='#a7a195');return els.slice(0,20).map(e=>{const b=e.getBoundingClientRect();return [e.dataset.wall,b.x,b.y,b.width,b.height]})});
  for (const [id,x,y,ww,hh] of w.slice(0,3)) { await page.mouse.click(x+ww/2,y+hh/2); await wait(150); }
  await shot(page,'04-duvar-yikma');
  await page.keyboard.press('Escape'); await page.keyboard.press('x'); // leave
  await page.keyboard.press('v');
  // toggle layers
  await page.click('[data-layer=bearing]'); await page.click('[data-layer=grid]'); await wait(200);
  await shot(page,'05-2d-katmanlar-tasiyici-grid');
  await page.click('[data-layer=bearing]'); await page.click('[data-layer=grid]');
  // room select -> materials panel
  await page.click('#panel tr[data-room=living]'); await wait(300);
  await shot(page,'06-sag-panel-malzemeler');
  await page.keyboard.press('Escape'); await wait(200);
  await shot(page,'06b-sag-panel-genel');
  // lib scroll sample
  // 3D
  await page.keyboard.press('t'); await wait(3800);
  await shot(page,'07-3d-kus-bakisi');
  info.h3d = await page.evaluate(()=>document.querySelector('#hint3d').textContent);
  await page.click('[data-cut="1.2"]'); await wait(1500);
  await shot(page,'08-3d-kesik-duvar');
  await page.click('[data-cut="2.8"]'); await wait(800);
  await page.click('[data-t=night]'); await wait(1200);
  await shot(page,'09-3d-gece');
  await page.click('[data-t=night]'); await wait(500);
  await page.fill('#sun','16.5').catch(async()=>{ await page.evaluate(()=>{const s=document.querySelector('#sun');s.value=16.5;s.dispatchEvent(new Event('input'))}); });
  await page.evaluate(()=>{const s=document.querySelector('#sun');s.value=16.5;s.dispatchEvent(new Event('input'))});
  await wait(800); await shot(page,'10-3d-gun-batimi-16-30');
  await page.evaluate(()=>{const s=document.querySelector('#sun');s.value=10;s.dispatchEvent(new Event('input'))});
  await page.click('#vTop'); await wait(1400); await shot(page,'11-3d-ustten');
  await page.click('#vIso'); await wait(1400);
  // room fly
  await page.click('#roomList button[data-room=living]'); await wait(1300); await shot(page,'12-3d-salona-ucus');
  await page.click('#roomList button[data-room=master]'); await wait(1300); await shot(page,'12b-3d-ana-yatak-odasi');
  // walk mode
  await page.click('[data-mode=walk]'); await wait(600);
  await shot(page,'13-3d-gezinti-baslangic-overlay');
  await ctx.close();
  // ---- touch walk (pointer coarse mobile)
  ({ctx,page} = await mk(390,844,{hasTouch:true,isMobile:true,deviceScaleFactor:2}));
  await shot(page,'14-mobil-2d');
  info.mobile = await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);const b=e.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};return {header:r('header'),main:r('main'),footer:r('footer'),lib:r('aside.lib'),right:r('aside.right'),coarse:matchMedia('(pointer:coarse)').matches}});
  await page.tap('#tgLib'); await wait(500); await shot(page,'15-mobil-kutuphane-cekmece');
  await page.tap('#tgLib'); await wait(400);
  await page.tap('#tgPanel'); await wait(500); await shot(page,'16-mobil-panel-cekmece');
  await page.tap('#tgPanel'); await wait(400);
  await page.tap('[data-view="3d"]'); await wait(4200); await shot(page,'17-mobil-3d');
  await page.tap('[data-mode=walk]'); await wait(500); await shot(page,'18-mobil-gezinti-overlay');
  await page.tap('#walkOverlay'); await wait(600);
  // simulate joystick
  const j = await page.locator('#joy').boundingBox();
  await page.evaluate(([x,y])=>{const el=document.querySelector('#joy');const ev=(t,cx,cy)=>el.dispatchEvent(new PointerEvent(t,{pointerId:5,clientX:cx,clientY:cy,bubbles:true,pointerType:'touch',isPrimary:true}));el.setPointerCapture=()=>{};ev('pointerdown',x,y-40);},[j.x+j.width/2,j.y+j.height/2]);
  await wait(1800); await shot(page,'19-mobil-gezinti-joystick');
  info.joy = j;
  await ctx.close();
  // ---- desktop walk with fake locked: use touch path? use desktop and force startTouchWalk not exposed; instead screenshot overlay + simulate keys with pointer lock unavailable
  ({ctx,page} = await mk(1440,900));
  await page.keyboard.press('t'); await wait(3800);
  await page.click('[data-mode=walk]'); await wait(500);
  await page.click('#walkOverlay').catch(()=>{}); await wait(800);
  await shot(page,'20-3d-gezinti-masaustu'); 
  await page.evaluate(()=>document.querySelector('#langBtn').click()); await wait(600);
  await shot(page,'21-3d-gezinti-ingilizce');
  await ctx.close();
  // ---- English 2D
  ({ctx,page} = await mk(1440,900));
  await page.click('#langBtn'); await wait(500);
  await shot(page,'22-2d-ingilizce');
  await page.click('#panel tr[data-room=kitchen]'); await wait(300); await shot(page,'23-ingilizce-oda-paneli');
  await ctx.close();
  // ---- tablet 1024 (narrow)
  ({ctx,page} = await mk(1024,768));
  await shot(page,'24-dar-1024-2d');
  info.tab = await page.evaluate(()=>{const b=document.querySelector('header').getBoundingClientRect();return [b.width,b.height]});
  await ctx.close();
  fs.writeFileSync('/tmp/info.json', JSON.stringify(info,null,1));
  await browser.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
