import ConsoleShell from "@/components/ConsoleShell";

/**
 * Console plateforme (extension v1.2) : le shell porte la garde
 * d'accès Admin / Super Admin et la navigation console.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
