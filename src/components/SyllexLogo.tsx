import logoIcon from "../assets/syllex-icon.png";

interface SyllexLogoProps {
  size?: number;
  className?: string;
}

export function SyllexLogo({ size = 72, className = "" }: SyllexLogoProps) {
  return (
    <img
      className={`syllex-logo-container ${className}`}
      src={logoIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
