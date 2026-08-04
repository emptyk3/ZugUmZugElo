# Produktion auf Vercel

## Build

In Vercel als Build Command eintragen:

```text
npm run vercel-build
```

Das Skript führt ausschließlich `prisma generate`, `prisma migrate deploy` und `next build` aus. In Produktion werden weder `migrate dev`, `migrate reset` noch `db push` verwendet. Jeder Vercel-Build arbeitet in seinem eigenen Build-Verzeichnis; lokal dürfen `next dev` und `next build` nicht gleichzeitig denselben `.next`-Ordner verwenden.

## Erforderliche Variablen

`DATABASE_URL`, `SESSION_SECRET` (mindestens 32 Zeichen), `APP_URL` (HTTPS), `ADMIN_SEED_PASSWORD` (mindestens 12 Zeichen), `EMAIL_VERIFICATION_REQUIRED` und `PROFILE_IMAGE_STORAGE_MODE=vercel-blob`.

Der öffentliche Vercel Blob Store muss für Production und Preview mit dem Projekt verbunden sein. Die aktuelle `@vercel/blob`-Version authentifiziert Uploads und Löschungen auf Vercel automatisch per OIDC; ein langlebiger `BLOB_READ_WRITE_TOKEN` ist dafür nicht erforderlich.

## Migration und Seed

Migrationen werden bei jedem Deployment idempotent mit `prisma migrate deploy` angewendet. Der Seed läuft bewusst nicht automatisch. Vor dem ersten Deployment beziehungsweise nach dem erstmaligen Setzen von `ADMIN_SEED_PASSWORD` einmal manuell in einer vertrauenswürdigen Umgebung ausführen:

```text
npm run db:seed
```

Der Seed erzeugt ausschließlich die sechs Missionen und den initialen Administrator per Upsert; keine Testspieler oder Testpartien.

## E-Mail

Mit `EMAIL_VERIFICATION_REQUIRED=false` starten neue Konten direkt als `PENDING_APPROVAL`. Für `true` muss vor Produktivbetrieb ein Mailprovider an `lib/auth/mail.ts` angebunden werden. Ohne Mailprovider verweist der Passwort-Reset in Produktion an einen Administrator.
