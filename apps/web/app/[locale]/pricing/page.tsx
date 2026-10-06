"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const plans = [
  { name: "Free", price: 0, features: ["Cheklangan kalkulyatorlar", "Qisman Bank-Readiness"] },
  { name: "Pro", price: 10, features: ["AI tahlil", "Biznes-reja", "PDF/Excel export"] },
  { name: "Business", price: 20, features: ["Pro imkoniyatlari", "Agent", "Investor marketplace"] },
];

export default function PricingPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [revenue, setRevenue] = useState("100000000");
  const commission = useMemo(() => {
    const amount = Math.max(0, Number(revenue) || 0);
    return Math.min(amount, 100000000) * .04 + Math.min(Math.max(amount - 100000000, 0), 900000000) * .02 + Math.max(amount - 1000000000, 0) * .01;
  }, [revenue]);
  const multiplier = period === "weekly" ? 1 : period === "monthly" ? 4 : 48;
  return <main><h1>Narxlar</h1><div><button onClick={() => setPeriod("weekly")}>Haftalik</button> <button onClick={() => setPeriod("monthly")}>Oylik</button> <button onClick={() => setPeriod("yearly")}>Yillik</button></div><div className="card-grid">{plans.map((plan) => <article className="card" key={plan.name}><h2>{plan.name}</h2><p>${plan.price * multiplier} / {period}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><Link className="button button-primary" href={`/uz/register?plan=${plan.name.toLowerCase()}`}>Boshlash</Link></article>)}</div><section style={{ marginTop: 48 }}><h2>Growth Partner komissiyasi</h2><label>Yillik tushum (so‘m) <input value={revenue} onChange={(event) => setRevenue(event.target.value)} /></label><p>Progressiv komissiya: {commission.toLocaleString("uz-UZ")} UZS</p></section></main>;
}
