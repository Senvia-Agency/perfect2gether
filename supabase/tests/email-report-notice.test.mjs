import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const stub=({children,...props})=>React.createElement('div',{'data-label':props.label},children);
function report({sent=1,delivered=0,opened=0,clicked=0}={}){
 const stats={sent,total:sent,delivered,opened,clicked,failed:0,bounced:0,spam:0,blocked:0,unsubscribed:0,deliveredRate:0,openRate:0,clickRate:0,daily:[],events:[]};
 const module={exports:{}};
 const ui=new Proxy({},{get:()=>stub});
 const compiled=ts.transpileModule(fs.readFileSync('src/pages/marketing/Reports.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(compiled,{exports:module.exports,require:name=>{
  if(name==='react'||name==='react/jsx-runtime'||name==='date-fns')return require(name);
  if(name==='@/hooks/useEmailStats')return{useEmailStats:()=>({data:stats,isLoading:false})};
  if(name==='@/hooks/useCampaigns')return{useCampaigns:()=>({data:[]})};
  if(name==='@/hooks/useEmailTemplates')return{useEmailTemplates:()=>({data:[]})};
  if(name==='@tanstack/react-query')return{useQueryClient:()=>({invalidateQueries(){}})};
  if(name==='react-router-dom')return{Link:({children,to})=>React.createElement('a',{href:to},children)};
  if(name==='@/types/marketing')return{EMAIL_SEND_STATUS_LABELS:{sent:'Enviado'},EMAIL_SEND_STATUS_STYLES:{sent:{}}};
  return ui;
 }});
 return renderToStaticMarkup(React.createElement(module.exports.default));
}
test('zero deliveries within the selected period never claims webhook configuration is missing',()=>{
 const html=report();assert.doesNotMatch(html,/Tracking de entregas não configurado|Configure o webhook/);
 assert.match(html,/Sem confirmações de entrega neste período/);assert.match(html,/90 dias/);
});
test('delivery evidence in the wider period hides the pending-event notice',()=>{
 const html=report({sent:5,delivered:2,opened:1});assert.doesNotMatch(html,/Sem confirmações de entrega neste período/);
});
export {report};
