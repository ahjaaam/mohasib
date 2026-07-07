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
    <div className="mt-7 rounded-2xl border border-[rgba(13,21,38,0.08)] bg-white/75 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">Partager cette page</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={nativeShare}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(13,21,38,0.10)] bg-white px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#C8924A] hover:text-[#C8924A]"
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
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(13,21,38,0.10)] bg-white px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#C8924A] hover:text-[#C8924A]"
          >
            <Icon size={14} />
            {label}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(13,21,38,0.10)] bg-white px-3.5 py-2 text-[12px] font-bold text-[#0D1526] transition hover:border-[#C8924A] hover:text-[#C8924A]"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
