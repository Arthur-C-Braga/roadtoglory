import { setRequestLocale } from "next-intl/server";
import { ContestForm } from "@/components/ContestForm";

export default async function ContestarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContestForm />;
}
