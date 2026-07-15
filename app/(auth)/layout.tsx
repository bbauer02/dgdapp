import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-hex px-4">
      <div className="panel relative w-full max-w-sm p-8 shadow-neon-violet">
        {/* corner slash */}
        <span className="absolute -left-1 top-6 h-2 w-10 -skew-x-[20deg] bg-lime" aria-hidden />
        <Link href="/" className="mb-8 block text-center">
          <span className="font-display text-3xl font-bold uppercase tracking-tight text-white">
            DGDAPP
          </span>
          <span className="kicker mt-1 block">Reconstitutions & Tournois</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
