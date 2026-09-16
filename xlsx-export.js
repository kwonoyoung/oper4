/* Minimal offline OOXML workbook writer. Exports computed values, never formulas. */
(function(root){
  'use strict';
  const encode=s=>new TextEncoder().encode(s);
  const escape=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function concat(chunks){const out=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0));let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;}
  function zip(files){const chunks=[],central=[];let offset=0;
    for(const [name,value] of Object.entries(files)){
      const path=encode(name),data=encode(value),sum=crc(data);
      const header=new Uint8Array(30),h=new DataView(header.buffer);
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,path.length,true);
      chunks.push(header,path,data);
      const directory=new Uint8Array(46),d=new DataView(directory.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,path.length,true);d.setUint32(42,offset,true);
      central.push(directory,path);offset+=header.length+path.length+data.length;
    }
    const tail=new Uint8Array(22),t=new DataView(tail.buffer),directory=concat(central),count=Object.keys(files).length;
    t.setUint32(0,0x06054b50,true);t.setUint16(8,count,true);t.setUint16(10,count,true);t.setUint32(12,directory.length,true);t.setUint32(16,offset,true);
    return concat([...chunks,directory,tail]);
  }
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function column(n){let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
  function makeXlsx(sheets){
    const files={
      '[Content_Types].xml':xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>',
      '_rels/.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':xml+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${escape(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>',
      'xl/_rels/workbook.xml.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>'
    };
    sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=xml+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="20" width="24" customWidth="1"/></cols><sheetData>'+s.rows.map((row,j)=>`<row r="${j+1}">`+row.map((v,k)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${column(k)}${j+1}"><v>${v}</v></c>`:`<c r="${column(k)}${j+1}" t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>');
    return zip(files);
  }
  if(typeof module==='object'&&module.exports)module.exports=makeXlsx;else root.makeXlsx=makeXlsx;
})(typeof globalThis==='undefined'?this:globalThis);
