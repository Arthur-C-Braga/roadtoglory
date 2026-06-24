import { setRequestLocale } from "next-intl/server";
import { MultiLocalClient } from "@/components/play/MultiLocalClient";

export default async function MultiLocalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MultiLocalClient />;
}
