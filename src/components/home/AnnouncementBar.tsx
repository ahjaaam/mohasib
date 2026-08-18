"use client";

import Link from "next/link";
import { Clock3, X } from "lucide-react";
import { useState } from "react";
import { appUrl } from "@/lib/public-urls";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <aside className={styles.bar} aria-label="Offre d’essai Mohasib">
      <div className={styles.inner}>
        <span className={styles.badge}>
          <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
          7 jours offerts
        </span>

        <p className={styles.message}>
          Passez à une gestion comptable automatisée
        </p>

        <span className={styles.divider} aria-hidden="true" />

        <p className={styles.trial}>
          <strong>Sans carte</strong>
          <span>bancaire</span>
        </p>

        <Link className={styles.action} href={appUrl("/inscription")}>
          Commencer
        </Link>
      </div>

      <button
        className={styles.close}
        type="button"
        aria-label="Masquer cette annonce"
        onClick={() => setVisible(false)}
      >
        <X size={19} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </aside>
  );
}
