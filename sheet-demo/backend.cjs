'use strict';
const ShareDB=require('@boss/sharedb');
const {SheetOTType}=require('./ot-type.cjs');
ShareDB.types.register(SheetOTType);
exports.createBackend=()=>{
 const backend=new ShareDB();
 // The production fork subscribes without snapshots (loaded through Dubbo).
 // This standalone adapter must supply snapshots initially and replay ops on reconnect.
 backend.subscribe=function(agent,index,id,version,options,callback){
  if(typeof options==='function'){callback=options;options=null;}
  if(options)return callback(new Error('Subscribe options are not supported'));
  const projection=this.projections[index],collection=projection?projection.target:index;
  this.pubsub.subscribe(this.getDocChannel(collection,id),(err,stream)=>{
   if(err)return callback(err);
   const finish=(error,snapshot,ops)=>{if(error){stream.destroy();return callback(error);}callback(null,stream,snapshot,ops);};
   if(version==null)this.fetch(agent,index,id,(error,snapshot)=>finish(error,snapshot));
   else this._getSanitizedOps(agent,projection,collection,id,version,null,null,(error,ops)=>finish(error,null,ops));
  });
 };
 return backend;
};
