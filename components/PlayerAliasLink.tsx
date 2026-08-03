import Link from "next/link";
import type { ReactNode } from "react";

type Props = { playerId: string; alias: string; className?: string; children?: ReactNode };

export default function PlayerAliasLink({ playerId, alias, className, children }: Props) {
  return <Link href={`/spieler/${playerId}`} className={className} aria-label={`Spielerprofil von ${alias}`}>{children ?? alias}</Link>;
}
