import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  variant?: "default" | "type";
}

export default function Logo({ size = "md", linkTo, variant = "default" }: LogoProps) {
  // logo_type.svg: 123x17 (ratio ~7.24:1)
  // logo.svg: 123x19 (ratio ~6.47:1)
  const sizes = {
    sm: variant === "type"
      ? { height: 20, width: 145 }
      : { height: 20, width: 129 },
    md: variant === "type"
      ? { height: 24, width: 174 }
      : { height: 24, width: 155 },
    lg: variant === "type"
      ? { height: 28, width: 203 }
      : { height: 28, width: 181 },
  };

  // Use logo_type.svg for navbar/header, regular logo.svg for other uses
  const logoSrc = variant === "type" ? "/logo_type.svg" : "/logo.svg";

  const logo = (
    <Image
      src={logoSrc}
      alt="SpecialTrips"
      height={sizes[size].height}
      width={sizes[size].width}
      priority
      className="object-contain"
    />
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="block">
        {logo}
      </Link>
    );
  }

  return logo;
}
