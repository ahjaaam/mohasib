type SidebarLogoProps = {
  light: boolean;
  compact?: boolean;
};

export default function SidebarLogo({ light, compact = false }: SidebarLogoProps) {
  const source = compact ? "/favicon.png" : "/logo.png";

  return (
    <span
      role="img"
      aria-label="Mohasib"
      className={compact ? "block h-7 w-7" : "block h-[23px] w-[120px]"}
      style={{
        backgroundColor: light ? "#0D1526" : "#FFFFFF",
        WebkitMaskImage: `url(${source})`,
        maskImage: `url(${source})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
