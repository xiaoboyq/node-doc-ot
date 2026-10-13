import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page,id:string){page.on('pageerror',e=>console.log('PAGE ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});await page.goto('/?sheet='+id);await expect(page.locator('.state')).toHaveText('协同中');await expect(page.locator('canvas')).toHaveCount(1);}
async function select(page:Page,r:number,c:number,shift=false){const box=await page.locator('.sheet-scroll').boundingBox();if(!box)throw Error('No grid');if(shift)await page.keyboard.down('Shift');await page.mouse.click(box.x+52+c*112+30,box.y+34+r*29+14);if(shift)await page.keyboard.up('Shift');}
async function edit(page:Page,value:string){await page.getByLabel('单元格内容').fill(value);await page.getByRole('button',{name:'提交单元格'}).click();}
test('two windows edit, insert, preserve draft, merge/split and virtualize',async({page,context})=>{
 const errors:string[]=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 const b=await context.newPage(),id='browser-'+Date.now();await Promise.all([ready(page,id),ready(b,id)]);
 await select(page,2,4);await select(b,2,4);await edit(page,'E3 非对称坐标');await expect(b.getByLabel('单元格内容')).toHaveValue('E3 非对称坐标');
 await b.getByLabel('单元格内容').fill('未提交草稿');await edit(page,'远程更新');await expect(b.getByLabel('单元格内容')).toHaveValue('未提交草稿');
 await b.getByRole('button',{name:'提交单元格'}).click();await expect(page.getByLabel('单元格内容')).toHaveValue('未提交草稿');
 await select(page,0,0);await page.getByRole('button',{name:'插入行'}).click();await expect(b.getByTestId('selection')).toHaveText('E4');await expect(b.getByLabel('单元格内容')).toHaveValue('未提交草稿');
 await page.getByRole('button',{name:'插入列'}).click();await expect(b.getByTestId('selection')).toHaveText('F4');await expect(b.getByLabel('单元格内容')).toHaveValue('未提交草稿');
 await select(page,1,1);await select(page,2,2,true);await expect(page.getByTestId('selection')).toHaveText('B2:C3');
 await page.getByRole('button',{name:'合并',exact:true}).click();await expect(b.locator('aside')).toContainText('update-merge');
 await select(b,2,2);await expect(b.getByTestId('selection')).toHaveText('B2');
 await b.getByRole('button',{name:'拆分'}).click();await select(page,2,2);await expect(page.getByTestId('selection')).toHaveText('C3');
 await page.locator('.sheet-scroll').evaluate(el=>{el.scrollTop=5500;el.scrollLeft=1800;});await expect.poll(()=>page.locator('.sheet-stage').getAttribute('data-rendered-cells')).toBeTruthy();
 const rendered=Number(await page.locator('.sheet-stage').getAttribute('data-rendered-cells'));expect(rendered).toBeLessThan(400);
 await page.screenshot({path:'test-results/sheet-virtualized.png'});expect(errors).toEqual([]);
});
test('offline pending edits rebase over a remote insert and reconnect',async({browser})=>{
 const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage(),id='reconnect-'+Date.now();
 try{
 await Promise.all([ready(a,id),ready(b,id)]);await select(a,2,4);await select(b,2,4);await edit(a,'initial');await expect(b.getByLabel('单元格内容')).toHaveValue('initial');
 await ca.setOffline(true);await expect(a.locator('.state')).toContainText('断开');await edit(a,'offline pending');
 await select(b,0,0);await b.getByRole('button',{name:'插入行'}).click();await ca.setOffline(false);
 await expect(a.locator('.state')).toHaveText(/协同连接已恢复|协同中/,{timeout:20000});await select(b,3,4);await expect(b.getByLabel('单元格内容')).toHaveValue('offline pending',{timeout:20000});
 await expect(a.getByTestId('selection')).toHaveText('E4');await expect(a.getByLabel('单元格内容')).toHaveValue('offline pending');
 await expect.poll(async()=>await a.getByTestId('version').textContent()).toEqual(await b.getByTestId('version').textContent());
 }finally{await ca.close();await cb.close();}
});
test('lost ACK retries original src/seq without duplicating an insertion',async({browser})=>{
 const ca=await browser.newContext(),cb=await browser.newContext();let cut=false,blocked=false;
 await ca.routeWebSocket('**/collaboration?*',ws=>{
  if(blocked){ws.close();return;}
  const server=ws.connectToServer();
  server.onMessage(message=>{
   const m=JSON.parse(String(message));
   if(!cut&&m.a==='op'&&m.seq&&!m.op&&!m.create&&!m.error){cut=true;blocked=true;ws.close();return;}
   ws.send(message);
  });
 });
 const a=await ca.newPage(),b=await cb.newPage(),id='ack-'+Date.now();
 try{
 await Promise.all([ready(a,id),ready(b,id)]);await select(b,2,4);await edit(b,'marker');await select(a,2,4);await expect(a.getByLabel('单元格内容')).toHaveValue('marker');
 await select(a,0,0);await a.getByRole('button',{name:'插入行'}).click();await expect.poll(()=>cut).toBe(true);
 await expect(b.getByTestId('selection')).toHaveText('E4');
 await select(b,0,0);await b.getByRole('button',{name:'插入列'}).click();await select(b,3,5);await expect(b.getByLabel('单元格内容')).toHaveValue('marker');
 blocked=false;await expect(a.locator('.state')).toHaveText('协同中',{timeout:20000});
 await select(a,3,5);await expect(a.getByLabel('单元格内容')).toHaveValue('marker');
 await expect.poll(async()=>await a.getByTestId('version').textContent()).toEqual(await b.getByTestId('version').textContent());
 await edit(a,'after retry');await expect(b.getByLabel('单元格内容')).toHaveValue('after retry');
 }finally{await ca.close();await cb.close();}
});
for(const first of ['insert','edit'])test(`concurrent browser OP transform, ${first} arrives first`,async({browser})=>{
 const ca=await browser.newContext(),cb=await browser.newContext();const queue:Array<{message:string|Buffer;send:()=>void}>=[];let hold=false;
 for(const context of [ca,cb])await context.routeWebSocket('**/collaboration?*',ws=>{
  const server=ws.connectToServer();ws.onMessage(message=>{
   if(hold&&JSON.parse(String(message)).a==='op')queue.push({message,send:()=>server.send(message)});
   else server.send(message);
  });
 });
 const a=await ca.newPage(),b=await cb.newPage(),id='concurrent-'+first+'-'+Date.now();
 try{
 await Promise.all([ready(a,id),ready(b,id)]);await select(a,1,0);await select(b,2,4);hold=true;
 await Promise.all([a.getByRole('button',{name:'插入行'}).click(),edit(b,'concurrent value')]);
 await expect.poll(()=>queue.length).toBe(2);const messages=queue.map(q=>JSON.parse(String(q.message)));expect(messages[0].v).toBe(messages[1].v);
 hold=false;queue.sort((x,y)=>Number(JSON.parse(String(x.message)).op[0].type==='insert-row')*(first==='insert'?-1:1)-Number(JSON.parse(String(y.message)).op[0].type==='insert-row')*(first==='insert'?-1:1));for(const q of queue)q.send();
 await expect(b.getByTestId('selection')).toHaveText('E4');await select(a,3,4);await expect(a.getByLabel('单元格内容')).toHaveValue('concurrent value');await expect(b.getByLabel('单元格内容')).toHaveValue('concurrent value');
 await expect.poll(async()=>await a.getByTestId('version').textContent()).toEqual(await b.getByTestId('version').textContent());
 }finally{await ca.close();await cb.close();}
});
