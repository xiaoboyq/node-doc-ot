import { defineConfig } from 'vite';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export default defineConfig({
 resolve:{alias:{events:require.resolve('events/'),'sheet-demo-ot':require.resolve('./ot-type.cjs')}},
 server:{port:5173,strictPort:true,proxy:{
 '/health':'http://127.0.0.1:8787',
 '/collaboration':{target:'ws://127.0.0.1:8787',ws:true}
 }},
 optimizeDeps:{include:['@boss/sharedb/lib/client','events','sheet-demo-ot']}
});
