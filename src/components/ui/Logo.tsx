import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
}

export default function Logo({ size = "md", linkTo }: LogoProps) {
  const sizes = {
    sm: { height: 24, width: 120 },
    md: { height: 32, width: 160 },
    lg: { height: 40, width: 200 },
  };

  const logo = (
    <Image
      src="/images/logo-black.png"
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
