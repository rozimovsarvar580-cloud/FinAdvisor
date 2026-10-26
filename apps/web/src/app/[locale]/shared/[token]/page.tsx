import { SharedPlanView } from "@/components/finadvisor/shared-plan-view";

export default function SharedPlanPage({
  params
}: {
  params: { token: string };
}) {
  return <SharedPlanView token={params.token} />;
}
