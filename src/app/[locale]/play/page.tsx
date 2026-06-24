import { setRequestLocale } from "next-intl/server";
import { PlayClient } from "@/components/play/PlayClient";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlayClient />;
}
