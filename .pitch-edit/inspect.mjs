import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('/Users/abdelhamidahjame/mohasib/output/presentations/Mohasib_Investor_Pitch_FR_v3.pptx'));
const r=await p.inspect({kind:'slide,textbox,shape,notes',maxChars:26000});
console.log(r.ndjson);
