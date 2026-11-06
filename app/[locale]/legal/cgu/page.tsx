import LegalPage from "@/components/LegalPage";

export default function Page({ params }: { params: { locale: string } }) {
  return <LegalPage params={params} page="terms" sections={6} />;
}
