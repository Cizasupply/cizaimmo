/**
 * Jeu d'icônes de navigation — SVG inline uniformes (aucune librairie
 * d'icônes dans l'app) : tracé 24×24, stroke currentColor, style
 * « outline » cohérent pour toutes les entrées des menus.
 *
 * Créé pour l'espace client (design « Marine & Or », 2026-11-07) dans
 * AppShell, puis EXTRAIT ici et ÉTENDU aux entrées de la console
 * (même traitement « Marine & Or » pour Admin, ordre du fondateur :
 * « Même chose pour Admin ») : AppShell et ConsoleShell partagent
 * désormais exactement le même jeu.
 */
const ICONES: Record<string, string[]> = {
  // Espace client (nav.*)
  dashboard: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"],
  buildings: ["M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", "M16 9h3a1 1 0 0 1 1 1v11", "M2.5 21h19", "M8 7h2", "M8 11h2", "M8 15h2"],
  apartments: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  tenants: ["M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M5 20.5c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5"],
  rents: ["M3 7h18v10H3z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  receipts: ["M6 3h12v18l-2-1.4-2 1.4-2-1.4L10 21l-2-1.4L6 21z", "M9 8h6", "M9 12h6"],
  expenses: ["M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z", "M3 10h18"],
  documents: ["M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M14 3v4h4"],
  alerts: ["M6 9.8a6 6 0 0 1 12 0c0 3.8 1.4 5.2 1.4 5.2H4.6S6 13.6 6 9.8Z", "M10 19a2.2 2.2 0 0 0 4 0"],
  messages: ["M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4.6 4.2v-4.2H5.5A1.5 1.5 0 0 1 4 14.5z"],
  reports: ["M4 3v17a1 1 0 0 0 1 1h16", "M8.5 16v-5", "M12.5 16V8", "M16.5 16v-8"],
  settings: ["M4 8h9.5", "M18.5 8H20", "M16 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M4 16h3.5", "M12.5 16H20", "M10 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  vitrine: ["M5 4h14l1.2 5.2H3.8z", "M5.5 12.5V20h13v-7.5", "M10 20v-5h4v5"],
  subscription: ["M3.5 8 7 11.5 12 5l5 6.5L20.5 8 19 17.5H5z", "M5 20.5h14"],
  contract: ["M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M14 3v4h4", "m9.2 14.6 2 2 4-4.6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  // Console plateforme (console.*) — ajouts du traitement console.
  overview: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"],
  accounts: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  managers: ["M10 14a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 10a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"],
  myFiles: ["M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z", "M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7", "M4 12.5h16"],
  // Dossier employé (2026-11-08) : carte d'identité.
  myEmployeeFile: ["M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z", "M8.5 13.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z", "M5.8 17.2c.5-1.4 1.5-2.1 2.7-2.1s2.2.7 2.7 2.1", "M14.5 9.5H19", "M14.5 13H19"],
  // Vérifier un employé (pack employé) : loupe + coche de validation.
  verifyEmployee: ["M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z", "M21 21l-5.2-5.2", "M8.1 10.3 9.9 12l2.9-3.3"],
  supervisedMessages: ["M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  journal: ["M8 6h11", "M8 12h11", "M8 18h11", "M4.2 6h.01", "M4.2 12h.01", "M4.2 18h.01"],
  suppressions: ["M4 7h16", "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "M6.5 7l.8 12.2A1 1 0 0 0 8.3 20h7.4a1 1 0 0 0 1-.8L17.5 7", "M10 11v6", "M14 11v6"],
  admins: ["M12 3l7 2.5V11c0 4.6-3 7.7-7 9.5-4-1.8-7-4.9-7-9.5V5.5z", "m9.2 11.8 2 2 3.8-4"],
  finances: ["M3 7h18v10H3z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  // Paie & Dépenses (finances de la plateforme) : grand livre / relevé.
  platformFinances: ["M6 2.5h12V21l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21z", "M9 7.5h6", "M9 11h6", "M9 14.5h4"],
};

export default function IconeNav({ nom, className = "h-5 w-5" }: { nom: string; className?: string }) {
  if (nom === "more") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="19" cy="12" r="1.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {(ICONES[nom] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
