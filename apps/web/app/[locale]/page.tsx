import { notFound } from "next/navigation";
import Link from "next/link";

import en from "../../../../packages/i18n/messages/en.json";
import ru from "../../../../packages/i18n/messages/ru.json";
import uz from "../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;
type Locale = keyof typeof messages;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const content = messages[locale as Locale].home;

  return (
    <main>
      <h1>{content.title}</h1>
      <p>{content.description}</p>
      <a href="#start">{content.action}</a>
      <section style={{ marginTop: 64 }}>
        <h2>Qanday ishlaydi?</h2>
        <ol><li>Ma’lumot kiriting</li><li>Hisob-kitobni ko‘ring</li><li>Reja va hujjat tayyorlang</li><li>Bank yoki investorga taqdim eting</li></ol>
      </section>
      <section style={{ marginTop: 48 }}>
        <h2>Imkoniyatlar</h2>
        <div className="card-grid">
          <article className="card"><h3>Finance engine</h3><p>Decimal asosidagi ishonchli hisob-kitoblar.</p></article>
          <article className="card"><h3>Bank-readiness</h3><p>Rejangizning moliyaviy tayyorgarlik tahlili.</p></article>
          <article className="card"><h3>What-if</h3><p>Turli stsenariylarni solishtiring.</p></article>
        </div>
      </section>
      <section style={{ marginTop: 48 }} id="start">
        <h2>Reja tuzishni boshlang</h2>
        <Link className="button button-primary" href={`/${locale}/wizard`}>{content.action}</Link>
        <Link className="button" href={`/${locale}/pricing`}>Narxlarni ko‘rish</Link>
      </section>
    </main>
  );
}
