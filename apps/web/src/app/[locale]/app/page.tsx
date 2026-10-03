import { redirect } from "@/i18n/navigation";

export default function AppIndex({ params }: { params: { locale: string } }) {
  redirect({ href: "/app/finadvisor", locale: params.locale });
}
