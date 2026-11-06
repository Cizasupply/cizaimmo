import LegalPage from "@/components/LegalPage";

export default function Page({ params }: { params: { locale: string } }) {
  return <LegalPage params={params} page="notice" sections={4} />;
}
