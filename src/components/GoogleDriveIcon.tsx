export default function GoogleDriveIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 87 78"
      fill="none"
    >
      <path d="M29 0h29l29 50.2H58L29 0Z" fill="#00AC47" />
      <path d="M29 0 0 50.2l14.5 25.1L43.5 25 29 0Z" fill="#FFBA00" />
      <path d="M14.5 75.3h58L87 50.2H29l-14.5 25.1Z" fill="#4285F4" />
    </svg>
  );
}
