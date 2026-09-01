import styles from "./FAQSection.module.css";

const questions = [
  {
    question: "Mohasib est-il adapté à la comptabilité marocaine ?",
    answer:
      "Oui. Mohasib prend en charge les besoins courants des entreprises au Maroc : facturation, écritures comptables, TVA, paie et exports à transmettre à votre comptable.",
  },
  {
    question: "Comment mes documents arrivent-ils dans Mohasib ?",
    answer:
      "Vous pouvez importer vos factures et notes de frais ou connecter votre boîte Gmail ou Outlook. Mohasib centralise les pièces, extrait les données utiles et les présente pour validation.",
  },
  {
    question: "L’IA remplace-t-elle mon comptable ?",
    answer:
      "Non. L’IA prépare les tâches répétitives comme la lecture des pièces, le classement et les rapprochements suggérés. Vous gardez la responsabilité des validations et votre comptable reste votre interlocuteur pour le contrôle et le conseil.",
  },
  {
    question: "Puis-je suivre mes paiements et mes échéances ?",
    answer:
      "Oui. Mohasib réunit factures, règlements et transactions pour faire ressortir les montants dus, les échéances à venir et les paiements à rapprocher.",
  },
  {
    question: "Puis-je collaborer avec mon expert-comptable ?",
    answer:
      "Oui. Vos documents et écritures restent organisés dans un même espace. Vous pouvez préparer des exports structurés et les transmettre à votre expert-comptable quand vous le souhaitez.",
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
          <h2 id="faq-title">Vos questions avant de commencer</h2>
          <p>
            Comprenez ce que Mohasib automatise, ce que vous validez et comment
            la plateforme s’intègre à votre organisation.
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
