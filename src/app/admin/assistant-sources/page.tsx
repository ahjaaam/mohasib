import AssistantSourcesManager from "./AssistantSourcesManager";

export default function AssistantSourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#976224]">Mohasib research</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0D1526]">Bibliothèque de sources</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Gérez ici le contenu utilisé par l’assistant : créez ou modifiez une source, collez son texte ou importez son PDF. L’enregistrement découpe le contenu en passages consultables et met à jour son statut. Une référence sans contenu indexé reste hors des réponses.</p>
      </header>
      <AssistantSourcesManager />
    </div>
  );
}
