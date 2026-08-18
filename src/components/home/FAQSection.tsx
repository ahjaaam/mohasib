import styles from "./FAQSection.module.css";

const questions = [
  {
    question: "Mohasib est-il adapté à la comptabilité marocaine ?",
    answer:
      "Oui. Mohasib est conçu autour des besoins des entreprises marocaines : facturation, écritures comptables, TVA, paie et exports structurés pour faciliter le travail de votre entreprise et de votre comptable.",
  },
  {
    question: "Comment mes documents arrivent-ils dans Mohasib ?",
    answer:
      "Vous pouvez transmettre vos factures et justificatifs, connecter votre boîte Gmail ou Outlook et centraliser les pièces reçues. Mohasib lit les documents et prépare les informations utiles pour votre validation.",
  },
  {
    question: "L’IA remplace-t-elle mon comptable ?",
    answer:
      "Non. L’IA accélère la collecte, la lecture et la préparation des opérations répétitives. Vous gardez le contrôle des validations et votre comptable peut se concentrer sur le contrôle, le conseil et les décisions importantes.",
  },
  {
    question: "Puis-je suivre mes paiements et mes échéances ?",
    answer:
      "Oui. Mohasib rassemble factures, règlements et transactions pour vous aider à repérer les montants dus, les échéances à venir et les rapprochements qui demandent votre attention.",
  },
  {
    question: "Puis-je collaborer avec mon expert-comptable ?",
    answer:
      "Oui. Vos documents et écritures restent organisés dans un même espace, et vous pouvez préparer des exports propres à partager avec votre expert-comptable lorsque vous en avez besoin.",
  },
  {
    question: "Mes données restent-elles sous mon contrôle ?",
    answer:
      "Oui. Les accès sont liés à votre espace de travail et vos connexions peuvent être gérées depuis votre compte. Vous choisissez les documents transmis, les personnes autorisées et le moment où vous exportez vos données.",
  },
] as const;

export default function FAQSection() {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Questions fréquentes</p>
          <h2 id="faq-title">Ce qu’il faut savoir avant de commencer</h2>
          <p>
            Des réponses simples sur le fonctionnement de Mohasib et la manière
            dont la plateforme s’intègre à votre gestion quotidienne.
          </p>
        </header>

        <div className={styles.list}>
          {questions.map(({ question, answer }, index) => (
            <details className={styles.item} key={question} open={index === 0}>
              <summary>
                <span>{question}</span>
                <span className={styles.toggle} aria-hidden="true" />
              </summary>
              <div className={styles.answer}>
                <p>{answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
