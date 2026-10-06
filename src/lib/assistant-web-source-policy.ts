type SourceTopic = "accounting" | "tax" | "payroll" | "companies" | "law" | "finance";
type SourceTier = "official" | "professional" | "reference";

type ApprovedWebSource = {
  domain: string;
  tier: SourceTier;
  topics: SourceTopic[];
};

// Domains transcribed from the user's Morocco resources workbook. Keep authority
// tiers explicit: secondary commentary is searchable, but official sources lead.
const APPROVED_WEB_SOURCES: ApprovedWebSource[] = [
  { domain: "sgg.gov.ma", tier: "official", topics: ["accounting", "tax", "payroll", "companies", "law", "finance"] },
  { domain: "finances.gov.ma", tier: "official", topics: ["accounting", "tax", "payroll", "finance"] },
  { domain: "tax.gov.ma", tier: "official", topics: ["tax", "payroll"] },
  { domain: "adala.justice.gov.ma", tier: "official", topics: ["payroll", "companies", "law"] },
  { domain: "cnss.ma", tier: "official", topics: ["payroll"] },
  { domain: "ompic.ma", tier: "official", topics: ["companies", "law"] },
  { domain: "mre.gov.ma", tier: "official", topics: ["payroll", "companies"] },
  { domain: "oec.ma", tier: "professional", topics: ["accounting", "tax"] },
  { domain: "wipo.int", tier: "reference", topics: ["companies", "law"] },
  { domain: "lec.ma", tier: "professional", topics: ["accounting", "tax", "payroll", "companies"] },
  { domain: "upsilon-consulting.com", tier: "professional", topics: ["accounting", "tax", "payroll", "companies"] },
  { domain: "caeexperts.ma", tier: "professional", topics: ["tax", "payroll", "companies"] },
  { domain: "eliteaudit.ma", tier: "professional", topics: ["accounting", "tax"] },
  { domain: "bdo.ma", tier: "professional", topics: ["accounting", "tax", "companies"] },
  { domain: "taxsummaries.pwc.com", tier: "professional", topics: ["tax", "payroll"] },
  { domain: "daralmoukawil.com", tier: "reference", topics: ["accounting", "tax", "companies"] },
  { domain: "droit-afrique.com", tier: "reference", topics: ["accounting", "tax", "companies", "law"] },
  { domain: "maloi.ma", tier: "reference", topics: ["accounting", "companies", "law"] },
  { domain: "guide.izri.ma", tier: "professional", topics: ["accounting", "tax", "payroll"] },
  { domain: "ccme.ma", tier: "reference", topics: ["tax"] },
  { domain: "apsf.ma", tier: "reference", topics: ["tax", "finance"] },
  { domain: "attijaricib.com", tier: "reference", topics: ["tax", "finance"] },
];

const TIER_ORDER: Record<SourceTier, number> = { official: 0, professional: 1, reference: 2 };

function inferTopics(question: string): Set<SourceTopic> {
  const text = question.toLocaleLowerCase("fr-MA");
  const topics = new Set<SourceTopic>();
  if (/comptabil|comptable|cgnc|pcge|écriture|ecriture|bilan|compte de résultat|états de synthèse|etats de synthese/.test(text)) topics.add("accounting");
  if (/fiscal|impôt|impot|cgi|tva|\bir\b|\bis\b|déclaration fiscale|declaration fiscale|loi de finances|retenue à la source/.test(text)) topics.add("tax");
  if (/paie|salaire|bulletin|code du travail|salari|cnss|amo|damancom|cotisation sociale/.test(text)) topics.add("payroll");
  if (/sarl|société|societe|entreprise|ompic|registre du commerce|statuts|création|creation/.test(text)) topics.add("companies");
  if (/loi|droit|obligation|réglement|reglement|jurid|contrat|code du commerce|responsabilité|responsabilite/.test(text)) topics.add("law");
  if (/change|transfert international|office des changes|financement|taux de change/.test(text)) topics.add("finance");
  return topics;
}

export function getApprovedAssistantDomains(question: string, blockedDomains: string[] = []) {
  const topics = inferTopics(question);
  const relevant = topics.size
    ? APPROVED_WEB_SOURCES.filter((source) => source.topics.some((topic) => topics.has(topic)))
    : APPROVED_WEB_SOURCES;
  const blocked = blockedDomains.map((domain) => domain.trim().toLowerCase().replace(/^www\./, "")).filter(Boolean);
  return [...relevant]
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
    .map((source) => source.domain)
    .filter((domain, index, domains) => domains.indexOf(domain) === index)
    .filter((domain) => !blocked.some((blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)));
}

export function isApprovedAssistantDomain(host: string, allowedDomains: string[]) {
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
