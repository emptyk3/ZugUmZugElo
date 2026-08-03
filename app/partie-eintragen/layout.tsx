import { requireUser } from "@/lib/auth/session";
export default async function Layout({children}:{children:React.ReactNode}) { await requireUser("/partie-eintragen"); return children; }
