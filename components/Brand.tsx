import Image from "next/image";

export function MixWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-sans font-bold tracking-[0.38em] ${className}`}
      style={{ WebkitTextStroke: "1.35px currentColor", color: "transparent" }}
    >
      MIX
    </span>
  );
}

export function LogoMixModels({
  className = "h-7 w-auto sm:h-8",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-mixmodels.png"
      alt="Mix Models Agency"
      width={416}
      height={62}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}

export function LogoImperatriz({
  className = "size-12",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-imperatriz.png"
      alt="Instituto Imperatriz Leopoldinense"
      width={512}
      height={512}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}

export function InstitutoSeal({
  className = "size-12",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return <LogoImperatriz className={className} priority={priority} />;
}

export function OfficialMarks({
  className = "",
  sealClassName = "size-11 sm:size-12",
  mixClassName = "h-5 w-auto sm:h-6",
  priority = false,
}: {
  className?: string;
  sealClassName?: string;
  mixClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      <LogoMixModels className={mixClassName} priority={priority} />
      <InstitutoSeal className={sealClassName} priority={priority} />
    </div>
  );
}

export function WindowDots() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}
