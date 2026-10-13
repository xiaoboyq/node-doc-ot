declare module '@boss/sharedb/lib/client' {
  const ShareDB: any;
  export default ShareDB;
}

declare module 'sheet-demo-ot' { export const SheetOTType: typeof import('@bzl/sheet-ottype').SheetOTType & {uri:string}; }
