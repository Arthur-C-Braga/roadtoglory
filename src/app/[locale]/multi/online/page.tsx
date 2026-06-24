import { setRequestLocale } from "next-intl/server";
import { MultiOnlineClient } from "@/components/play/MultiOnlineClient";

export default async function MultiOnlinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MultiOnlineClient />;
}
