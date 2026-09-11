import {test,expect} from '@playwright/test';
import {defaults,publicConfig} from '../../runtime/config.mjs';
import {PACKS} from '../../runtime/packs.mjs';

async function fixture(page,{onboarded=false,theme='light'}={}){
  const config=publicConfig({...defaults(),onboarded,provider:'codex',name:'Taylor',purpose:'Help my agency deliver client projects.',businessProfile:{...defaults().businessProfile,businessName:'Example Studio'},appearance:{theme,textSize:'standard',density:'comfortable',city:'still'}});
  let session={id:'11111111-1111-4111-8111-111111111111',kind:onboarded?'conversation':'onboarding',status:'idle',revision:0,pendingJobId:null,turns:[{id:'welcome',role:'assistant',text:'What does your business do, and what would you like ARGUS to help you accomplish first?'}]};
  const submissions=[];
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),action=url.pathname.slice(5),data=route.request().method()==='POST'?route.request().postDataJSON():{};
    let result={};
    if(action==='state')result={config,sources:[],metrics:[],tasks:[],notes:[],jobs:[],workflows:[],runner:{alive:true,busy:false},providers:{codex:{installed:true},claude:{installed:false}}};
    if(action==='setup')result={application:'ready',provider:'codex',providers:{codex:{installed:true},claude:{installed:false}},runner:{alive:true},voice:{status:'installing',stage:'models',message:'Downloading local speech',progress:45,listening:false,speaking:false,serviceReady:false}};
    if(action==='voice/health')result={ok:false,stt:false};
    if(action==='conversation')result={session};
    if(action==='conversation/turn'){
      submissions.push(data);session={...session,revision:session.revision+1,status:'idle',pendingJobId:null,turns:[...session.turns,{id:`u-${submissions.length}`,role:'user',text:data.text},{id:`a-${submissions.length}`,role:'assistant',text:'A client project tracker sounds useful. What usually delays delivery?',spokenText:'What usually delays delivery?'}]};result={session};
    }
    if(action==='onboarding/preview')result={config,draft:{answers:{}}};
    if(action==='packs')result={packs:PACKS};
    if(action==='onboarding/complete'){Object.assign(config,data.answers,{onboarded:true});result={config};}
    if(action==='settings'){Object.assign(config,data);result=config;}
    if(action==='features')result={features:[],builds:[]};
    if(action==='features/build')result={id:'build',status:'queued'};
    await route.fulfill({json:result});
  });
  return {config,submissions};
}

test('typed interview remains usable during downloads and restores both sides',async({page})=>{
  const {submissions}=await fixture(page);await page.goto('/');
  await expect(page.getByRole('heading',{name:'Tell me what you’re building.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Start talking'})).toBeDisabled();
  await page.getByLabel('Your message to ARGUS').fill('I run a design agency. Help me track client work.');
  await page.getByRole('button',{name:'Send ↗',exact:true}).click();
  await expect(page.getByText('A client project tracker sounds useful. What usually delays delivery?')).toBeVisible();
  expect(submissions).toHaveLength(1);expect(submissions[0].requestId).toBeTruthy();
  await page.reload();await expect(page.getByText('I run a design agency. Help me track client work.',{exact:true})).toBeVisible();
  await expect(page.getByText('A client project tracker sounds useful. What usually delays delivery?')).toBeVisible();
  await page.getByRole('button',{name:'Correct this'}).click();
  await expect(page.getByLabel('Your message to ARGUS')).toHaveValue(/^Correction:/);
});

test('editable brief has all packs, genuine preferences, and acceptance',async({page})=>{
  const {config}=await fixture(page);await page.goto('/');await page.getByRole('button',{name:'Review my setup'}).click();
  await expect(page.getByRole('heading',{name:'Here’s what we’ll build around.'})).toBeVisible();
  const pack=page.getByLabel('A starting pack');await expect(pack.locator('option')).toHaveCount(4);
  await pack.selectOption('agency');await page.getByLabel('Try this pack with demonstration data').check();
  await page.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');
  await page.getByRole('combobox',{name:'Text size',exact:true}).selectOption('large');
  await page.getByLabel('Information density').selectOption('compact');
  await page.getByRole('combobox',{name:'City',exact:true}).selectOption('still');
  await page.getByRole('button',{name:'Create my ARGUS'}).click();
  await expect(page.getByRole('button',{name:'Look & feel'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('html')).toHaveAttribute('data-text-size','large');
  await expect(page.locator('html')).toHaveAttribute('data-density','compact');
  expect(config.starterPack).toBe('agency');
});

for(const width of [1440,390])test(`onboarding and builder fit ${width}px and preserve keyboard operation`,async({page})=>{
  await page.setViewportSize({width,height:1000});await fixture(page);await page.goto('/');
  await expect(page.getByLabel('Your message to ARGUS')).toBeVisible();
  await expect(page.getByRole('region',{name:'Horizon city view'})).toBeVisible();
  const door=page.locator('.city-door-left');
  expect(await door.evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
  await expect(page.getByText('What does your business do, and what would you like ARGUS to help you accomplish first?',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.playwright/onboarding-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Review my setup'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('configured students can build and edit appearance without restarting onboarding',async({page})=>{
  await fixture(page,{onboarded:true});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Tell me what you’re building.'})).toHaveCount(0);
  await page.getByRole('button',{name:'Build something',exact:true}).click();
  await expect(page.getByRole('heading',{name:'What would make your work easier?'})).toBeVisible();
  await page.getByRole('button',{name:'A lead follow-up tracker'}).click();
  await expect(page.getByLabel('Describe your feature')).toHaveValue(/lead follow-up tracker/);
  await page.screenshot({path:'.playwright/builder-desktop.png',fullPage:true});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Look & feel'}).click();
  await page.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');await page.getByRole('button',{name:'Save my look'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:'.playwright/dashboard-dark.png',fullPage:true});
});
