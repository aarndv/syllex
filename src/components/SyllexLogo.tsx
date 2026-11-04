import logoWithTextDark from "../assets/syllex-icon-with-text-dark.png";

interface SyllexLogoProps {
  width?: number;
  className?: string;
}

export function SyllexLogo({ width = 162, className = "" }: SyllexLogoProps) {
  return (
    <img
      className={`syllex-logo-container ${className}`}
      src={logoWithTextDark}
      width={width}
      height={width / 3}
      alt=""
      aria-hidden="true"
    />
  );
}
