import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = '/Users/abdelhamidahjame/mohasib';
const source = path.join(workspaceDir, 'output/presentations/Mohasib_Investor_Pitch_FR_v3.pptx');
const buildDir = path.join(workspaceDir, '.pitch-edit');
const presentation = await PresentationFile.importPptx(await FileBlob.load(source));

const copy = {
  'sh/b29kza94': 'LE TRAVAIL FINANCIER MANUEL',
  'sh/a10jqpsj': 'Le travail financier manuel ralentit l’entreprise.',
  'sh/x4r21kru': 'Les pièces sont dispersées, les vérifications se font à la main et les décisions attendent.',
  'sh/ove9o7yd': 'Collecter',
  'sh/9wnqhczy': 'Factures et reçus arrivent par e-mail, WhatsApp et papier.',
  'sh/xk7qlczu': 'Ressaisir',
  'sh/ahwrqhgj': 'La même information est retapée dans plusieurs fichiers et outils.',
  'sh/t8byxkn2': 'Vérifier',
  'sh/s72xofmh': 'Paiements et relevés ne correspondent pas toujours aux pièces.',
  'sh/gbmxszmt': 'Coordonner',
  'sh/fadgzu58': 'Dirigeant et cabinet se relancent pour les pièces et corrections.',
  'sh/u94fqp4n': 'Résultat : moins de visibilité, des paiements retardés et du temps retiré à l’activité.'
};
for (const [id, value] of Object.entries(copy)) presentation.resolve(id).text = value;

const notes = `Idée centrale : le frein n’est pas seulement la comptabilité. C’est le travail manuel nécessaire pour rassembler, retaper, contrôler et faire circuler l’information financière. Ces causes sont un brainstorm de frictions fréquentes à valider auprès des PME et cabinets Mohasib ; ne pas les présenter comme des mesures clients sans données.

Brainstorm des causes :
• Collecte dispersée : factures et reçus reçus par e-mail, WhatsApp, papier, dossiers partagés ou téléphone ; pièces manquantes, en doublon ou difficiles à retrouver ; informations sans format ou nommage commun.
• Ressaisie : copier les montants, dates, fournisseurs et références d’un document vers un tableur puis vers un outil comptable ; erreurs de frappe ; doublons ; noms fournisseurs/clients incohérents ; corrections répétées.
• Lecture et classement : scans peu lisibles ; saisie et validation manuelles ; catégorisation des dépenses, comptes, TVA ou période ; cas particuliers qui nécessitent une vérification humaine.
• Vérification et rapprochement : relier facture, paiement et ligne bancaire ; rechercher les écarts, paiements partiels et frais ; suivre les factures payées ou impayées ; confirmer qu’une pièce est complète et justifiée.
• Outils séparés : facturation, banque, paie, tableurs, comptabilité et archivage ne partagent pas toujours les mêmes données ; un changement doit être recopié à plusieurs endroits ; chacun garde sa version.
• Coordination : dirigeant, équipe et cabinet échangent les pièces manquantes et les corrections par plusieurs canaux ; les dossiers incomplets reviennent ; les questions restent en attente ; la clôture se concentre en fin de mois.
• Visibilité tardive : chiffres disponibles après collecte et contrôle ; trésorerie, dépenses, encaissements, TVA et échéances difficiles à voir au fil de l’eau ; décisions prises avec des données anciennes ou estimées.
• Effets opérationnels : factures clients émises ou relancées tard ; retards d’encaissement ou de paiement fournisseurs ; moins de temps pour vendre et servir les clients ; dépendance à une personne qui connaît les fichiers ; chaque nouvelle transaction ajoute du travail administratif.
• Risques et coûts : erreurs évitables, pièces justificatives manquantes, échéances fiscales/sociales plus difficiles à suivre ; temps dirigeant/cabinet absorbé par des tâches répétitives ; visibilité limitée pour anticiper un besoin de trésorerie.

Lien avec Mohasib : une même base partagée pour recevoir les pièces, extraire et vérifier les informations, suivre les flux et réutiliser les données dans les briques financières. Le client peut commencer par le besoin urgent (documents/OCR, facturation, dépenses, banque ou paie) et ajouter des usages sans reconstruire ses données. Le cabinet peut participer au même dossier au lieu de récupérer un lot de pièces tardivement. Le pitch doit ensuite étayer chaque bénéfice avec des mesures vérifiables : temps de traitement, délai de clôture, taux de pièces manquantes/à corriger, délai d’encaissement et usage des briques.`;
presentation.slides.items[1].speakerNotes.textFrame.setText(notes);

const candidatePath = path.join(buildDir, 'candidate-v4.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const preview = await presentation.export({ slide: presentation.slides.items[1], format: 'png', scale: 1 });
await fs.writeFile(path.join(buildDir, 'slide-2-v4.png'), new Uint8Array(await preview.arrayBuffer()));
const layout = await presentation.slides.items[1].export({format:'layout'});
await fs.writeFile(path.join(buildDir, 'slide-2-v4.layout.json'), await layout.text());

const { finalizePresentation } = await import(pathToFileURL(path.join(process.env.SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
const finalPath = path.join(workspaceDir, 'output/presentations/Mohasib_Investor_Pitch_FR_v4.pptx');
const receiptPath = path.join(buildDir, 'validation-v4.json');
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: process.env.RUNTIME_PYTHON,
  integrityValidatorPath: path.join(process.env.SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(process.env.SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: {basis:'reference',families:['Calibri'],referencePath:path.join(workspaceDir,'Mohasib_Investor_Pitch_Deck.pptx'),referenceSha256:'87b433f077162874d62ecb5b32471982381c5d803449e81659d3efbae1a2aeaa'},
  verifyArtifactToolImport: true,
  receiptPath
});
console.log(JSON.stringify(result, null, 2));
