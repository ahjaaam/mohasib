import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('/Users/abdelhamidahjame/mohasib/output/presentations/Mohasib_Investor_Pitch_FR_v4.pptx'));
const r=await p.inspect({kind:'notes',maxChars:20000});
console.log(r.ndjson.split('\n').filter(x=>x.includes('slideIndex":1')).join('\n'));
