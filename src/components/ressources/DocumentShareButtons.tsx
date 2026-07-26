"use client";

import { useState } from "react";
import { Check, Copy, Linkedin, MessageCircle, Share2 } from "lucide-react";

type DocumentShareButtonsProps = {
  title: string;
  url: string;
  description?: string;
};

export default function DocumentShareButtons({ title, url, description = "document gratuit Mohasib AI" }: DocumentShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const shareText = encodeURIComponent(`${title} — ${description}`);

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text: `${title} — ${description}`, url });
      } catch {
        // User cancelled or browser blocked it. No need to show an error.
      }
      return;
    }

    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const shareLinks = [
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Linkedin,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${shareText}%20${encodedUrl}`,
      icon: MessageCircle,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: Share2,
    },
  ];

  return (
    <div className="public-surface mt-7 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">Partager cette page</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={nativeShare}
          className="inline-flex items-center gap-2 border border-[#D5D4CE] bg-[#F8F7F7] px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#A89596] hover:bg-[#F1EDEE] hover:text-[#7A6668]"
        >
          <Share2 size={14} />
          Partager
        </button>
        {shareLinks.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-[#D5D4CE] bg-[#F8F7F7] px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#A89596] hover:bg-[#F1EDEE] hover:text-[#7A6668]"
          >
            <Icon size={14} />
            {label}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 border border-[#D5D4CE] bg-[#F8F7F7] px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#A89596] hover:bg-[#F1EDEE] hover:text-[#7A6668]"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
