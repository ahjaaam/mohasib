"use client";

import { X } from "lucide-react";
import { useState } from "react";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <aside className={styles.bar} aria-label="Facturation gratuite Mohasib">
      <div className={styles.inner}>
        <p className={styles.message}>
          Créez et envoyez vos factures professionnelles gratuitement
        </p>

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
