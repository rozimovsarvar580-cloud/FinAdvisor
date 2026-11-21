export type IconName =
  | "arrowRight"
  | "bank"
  | "briefcase"
  | "chart"
  | "check"
  | "close"
  | "coins"
  | "document"
  | "fileCheck"
  | "download"
  | "menu"
  | "moon"
  | "plus"
  | "shuffle"
  | "sparkles"
  | "sun"
  | "target"
  | "users"
  | "wallet";

const iconPaths: Record<IconName, readonly string[]> = {
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  bank: [
    "m3 9 9-5 9 5",
    "M5 10v8",
    "M9 10v8",
    "M15 10v8",
    "M19 10v8",
    "M3 20h18",
    "M4 18h16"
  ],
  briefcase: [
    "M4 7h16a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z",
    "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
    "M3 12h18",
    "M10 12v2h4v-2"
  ],
  chart: ["M4 19V5", "M4 19h16", "m7 15 4-4 3 2 5-7"],
  check: ["m5 12 4 4L19 6"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  coins: [
    "M12 6c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z",
    "M4 9v4c0 1.7 3.6 3 8 3s8-1.3 8-3V9",
    "M4 13v3c0 1.7 3.6 3 8 3 1.1 0 2.2-.1 3.2-.3"
  ],
  document: [
    "M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z",
    "M14 3.75v4h4",
    "M9 12h6",
    "M9 16h6"
  ],
  fileCheck: [
    "M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z",
    "M14 3.75v4h4",
    "m8.5 14 2 2 4-4"
  ],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 19h14"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  moon: ["M20.5 15.5A8 8 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z"],
  plus: ["M12 5v14", "M5 12h14"],
  shuffle: [
    "m16 3 4 4-4 4",
    "M4 7h2.5a5 5 0 0 1 4 2l3 6a5 5 0 0 0 4 2H20",
    "m16 13 4 4-4 4",
    "M4 17h2.5a5 5 0 0 0 3-1"
  ],
  sparkles: [
    "m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z",
    "m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"
  ],
  sun: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    "M12 2v2",
    "M12 20v2",
    "m4.93 4.93 1.42 1.42",
    "m17.65 17.65 1.42 1.42",
    "M2 12h2",
    "M20 12h2",
    "m6.35 17.65-1.42 1.42",
    "m19.07 4.93-1.42 1.42"
  ],
  target: [
    "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    "M12 12h.01"
  ],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75"
  ],
  wallet: [
    "M4 7.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 1-2Z",
    "M3.5 8 6 4.5h13",
    "M16 13h.01"
  ]
};

export function Icon({
  className = "h-5 w-5",
  name
}: {
  className?: string;
  name: IconName;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {iconPaths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
