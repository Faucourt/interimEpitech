import logoUrl from "../../images/cleanmatch-logo.png";

export type LogoSize = "1" | "2" | "3" | "4";

const sizes: Record<LogoSize, string> = {
  "1": "size-8",
  "2": "size-12",
  "3": "size-16",
  "4": "size-24",
};

export type LogoProps = {
  size?: LogoSize;
  alt?: string;
  className?: string;
};

export function Logo({
  size = "2",
  alt = "CleanMatch",
  className = "",
}: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={size === "1" ? 32 : size === "2" ? 48 : size === "3" ? 64 : 96}
      height={size === "1" ? 32 : size === "2" ? 48 : size === "3" ? 64 : 96}
      className={`block object-contain ${sizes[size]} ${className}`}
    />
  );
}
