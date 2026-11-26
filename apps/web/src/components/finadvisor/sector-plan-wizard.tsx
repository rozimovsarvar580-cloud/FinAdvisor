"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { PlanWizard, type PlanResult } from "@/components/finadvisor/plan-wizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const sectorSchema = z.object({
  id: z.string(),
  names: z.record(z.string()),
  revenue_model_type: z.enum([
    "capacity_utilization",
    "unit_sales",
    "hourly_service",
    "recurring",
    "project_based"
  ]),
  cost_categories: z.array(z.string()),
  staff_roles: z.array(z.string())
});
const sectorsSchema = z.array(sectorSchema);
const roleLineSchema = z.object({
  role: z.string(),
  employeeCount: z.string(),
  monthlySalary: z.string()
});
const costLineSchema = z.object({
  category: z.string(),
  monthlyAmount: z.string()
});
const customCostSchema = z.object({
  name: z.string(),
  monthlyAmount: z.string()
});
const draftSchema = z.object({
  step: z.number().int().min(0).max(3),
  sectorId: z.string(),
  stage: z.enum(["idea", "starting", "operating", "growing"]),
  otherDescription: z.string(),
  values: z.object({
    businessName: z.string(),
    location: z.string(),
    revenue: z.record(z.string()),
    roles: z.array(roleLineSchema),
    customRoles: z.array(roleLineSchema),
    costs: z.array(costLineSchema),
    customCosts: z.array(customCostSchema)
  })
});

type SectorDefinition = z.infer<typeof sectorSchema>;
type RoleLine = z.infer<typeof roleLineSchema>;
type Draft = z.infer<typeof draftSchema>;
type RevenueFieldKey =
  | "capacityUnits"
  | "turnsOrOccupancy"
  | "operatingDaysPerMonth"
  | "utilizationPercent"
  | "averageTicket"
  | "unitsPerMonth"
  | "pricePerUnit"
  | "staffHoursPerMonth"
  | "hourlyRate"
  | "startingSubscribers"
  | "averageRevenuePerUser"
  | "monthlyChurnPercent"
  | "projectOpportunities"
  | "averageProjectValue"
  | "conversionPercent";

const initialDraft: Draft = {
  step: 0,
  sectorId: "",
  stage: "idea",
  otherDescription: "",
  values: {
    businessName: "",
    location: "",
    revenue: {},
    roles: [],
    customRoles: [],
    costs: [],
    customCosts: []
  }
};
const draftStorageKey = "finadvisor.sector-plan-draft";
const revenueFieldSets: Record<
  SectorDefinition["revenue_model_type"],
  { key: string; label: RevenueFieldKey; percent?: boolean }[]
> = {
  capacity_utilization: [
    { key: "capacity_units", label: "capacityUnits" },
    { key: "turns_or_occupancy_per_day", label: "turnsOrOccupancy" },
    { key: "operating_days_per_month", label: "operatingDaysPerMonth" },
    { key: "utilization_percent", label: "utilizationPercent", percent: true },
    { key: "average_ticket", label: "averageTicket" }
  ],
  unit_sales: [
    { key: "units_per_month", label: "unitsPerMonth" },
    { key: "price_per_unit", label: "pricePerUnit" }
  ],
  hourly_service: [
    { key: "staff_hours_per_month", label: "staffHoursPerMonth" },
    { key: "rate_per_hour", label: "hourlyRate" },
    { key: "utilization_percent", label: "utilizationPercent", percent: true }
  ],
  recurring: [
    { key: "starting_subscribers", label: "startingSubscribers" },
    { key: "average_revenue_per_user", label: "averageRevenuePerUser" },
    { key: "monthly_churn_percent", label: "monthlyChurnPercent", percent: true }
  ],
  project_based: [
    { key: "project_opportunities_per_month", label: "projectOpportunities" },
    { key: "average_project_value", label: "averageProjectValue" },
    { key: "conversion_percent", label: "conversionPercent", percent: true }
  ]
};
const iconByRevenueModel: Record<SectorDefinition["revenue_model_type"], IconName> = {
  capacity_utilization: "bank",
  unit_sales: "wallet",
  hourly_service: "users",
  recurring: "coins",
  project_based: "briefcase"
};
const stageOptions = ["idea", "starting", "operating", "growing"] as const;

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function initialValuesForSector(sector: SectorDefinition, previous: Draft["values"]) {
  const previousRoles = new Map(
    [...previous.roles, ...previous.customRoles].map((role) => [role.role, role])
  );
  const previousCosts = new Map(previous.costs.map((cost) => [cost.category, cost]));
  return {
    ...previous,
    revenue: Object.fromEntries(
      revenueFieldSets[sector.revenue_model_type].map(({ key }) => [
        key,
        previous.revenue[key] ?? ""
      ])
    ),
    roles: sector.staff_roles.map(
      (role) => previousRoles.get(role) ?? { role, employeeCount: "", monthlySalary: "" }
    ),
    costs: sector.cost_categories.map(
      (category) => previousCosts.get(category) ?? { category, monthlyAmount: "" }
    )
  };
}

export function SectorPlanWizard({
  onGenerated
}: {
  onGenerated: (result: PlanResult) => void;
}) {
  const t = useTranslations("finadvisor.wizard.sector");
  const wizard = useTranslations("finadvisor.wizard");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const { data: session } = useSession();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [draftError, setDraftError] = useState<string>();
  const [sectors, setSectors] = useState<SectorDefinition[]>([]);
  const [sectorLoadState, setSectorLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [search, setSearch] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [saveError, setSaveError] = useState<string>();
  const [savedPlanId, setSavedPlanId] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const loadSectors = useCallback(async () => {
    setSectorLoadState("loading");
    try {
      const response = await fetch("/api/sectors", { cache: "no-store" });
      if (!response.ok) throw new Error("Sector registry request failed");
      setSectors(sectorsSchema.parse(await response.json()));
      setSectorLoadState("ready");
    } catch {
      setSectorLoadState("error");
    }
  }, []);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(draftStorageKey);
      if (serialized) {
        const parsed = draftSchema.safeParse(JSON.parse(serialized));
        if (parsed.success) {
          setDraft(parsed.data);
        } else {
          setDraftError("draftInvalid");
        }
      }
    } catch {
      setDraftError("draftUnavailable");
    } finally {
      setDraftReady(true);
    }
    void loadSectors();
  }, [loadSectors]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      setDraftError("draftUnavailable");
    }
  }, [draftReady, draft]);

  const selectedSector = sectors.find((sector) => sector.id === draft.sectorId);
  const filteredSectors = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return sectors.filter((sector) =>
      sector.names[locale]?.toLocaleLowerCase(locale).includes(query)
    );
  }, [locale, search, sectors]);

  function chooseSector(sector: SectorDefinition) {
    setDraft((current) => ({
      ...current,
      sectorId: sector.id,
      values: initialValuesForSector(sector, current.values)
    }));
    setSaveError(undefined);
    setSavedPlanId(undefined);
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateValue<K extends keyof Draft["values"]>(
    key: K,
    value: Draft["values"][K]
  ) {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [key]: value }
    }));
  }

  function updateRole(
    kind: "roles" | "customRoles",
    index: number,
    field: "employeeCount" | "monthlySalary",
    value: string
  ) {
    const rows = [...draft.values[kind]];
    rows[index] = { ...rows[index], [field]: value };
    updateValue(kind, rows);
  }

  function advanceStep() {
    const fields = fieldsetRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");
    if (fields && !Array.from(fields).every((field) => field.reportValidity())) return;
    if (draft.step === 0 && !selectedSector) {
      setSaveError("sectorRequired");
      return;
    }
    setSaveError(undefined);
    setDraft((current) => ({ ...current, step: Math.min(current.step + 1, 3) }));
  }

  function addCustomRole() {
    const role = customRole.trim();
    if (!role) return;
    updateValue("customRoles", [
      ...draft.values.customRoles,
      { role, employeeCount: "", monthlySalary: "" }
    ]);
    setCustomRole("");
  }

  function addCustomCost() {
    const name = customCost.trim();
    if (!name) return;
    updateValue("customCosts", [
      ...draft.values.customCosts,
      { name, monthlyAmount: "" }
    ]);
    setCustomCost("");
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(undefined);
    if (!session?.accessToken) {
      setSaveError("planSessionRequired");
      return;
    }
    if (!selectedSector || selectedSector.id === "restaurant_cafe") {
      setSaveError("sectorRequired");
      return;
    }
    setIsSaving(true);
    const inputs = {
      stage: draft.stage,
      description: draft.otherDescription,
      revenue_model_type: selectedSector.revenue_model_type,
      revenue: draft.values.revenue,
      cost_categories: selectedSector.cost_categories,
      staff_roles: selectedSector.staff_roles,
      staff: [
        ...draft.values.roles,
        ...draft.values.customRoles
      ].map((role) => ({
        role: role.role,
        employee_count: role.employeeCount,
        monthly_salary: role.monthlySalary
      })),
      costs: draft.values.costs.map((cost) => ({
        category: cost.category,
        monthly_amount: cost.monthlyAmount
      })),
      custom_cost_lines: draft.values.customCosts.map((cost) => ({
        name: cost.name,
        monthly_amount: cost.monthlyAmount
      }))
    };

    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          business_name: draft.values.businessName,
          location: draft.values.location,
          sector_id: selectedSector.id,
          inputs
        })
      });
      if (!response.ok) {
        setSaveError(response.status === 401 ? "planSessionRequired" : "sectorDraftFailed");
        return;
      }
      const result = z.object({ id: z.string().min(1) }).parse(await response.json());
      setSavedPlanId(result.id);
    } catch (error) {
      if (error instanceof TypeError) {
        setSaveError("planServiceUnavailable");
        return;
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        setSaveError("sectorDraftFailed");
        return;
      }
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  if (sectorLoadState === "loading") {
    return (
      <Card className="p-6" role="status">
        {t("loading")}
      </Card>
    );
  }
  if (sectorLoadState === "error") {
    return (
      <Card className="space-y-4 p-6">
        <p role="alert">{errors("sectorListUnavailable")}</p>
        <Button onClick={() => void loadSectors()} type="button" variant="outline">
          {t("retry")}
        </Button>
      </Card>
    );
  }

  if (draft.step > 0 && selectedSector?.id === "restaurant_cafe") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("selectedSector", { name: selectedSector.names[locale] })}
          </p>
          <Button
            onClick={() => updateDraft({ step: 0 })}
            type="button"
            variant="outline"
          >
            {t("changeSector")}
          </Button>
        </div>
        <PlanWizard
          onGenerated={onGenerated}
          sectorContext={{
            stage: draft.stage,
            otherDescription: draft.otherDescription
          }}
        />
      </div>
    );
  }

  const revenueFields = selectedSector
    ? revenueFieldSets[selectedSector.revenue_model_type]
    : [];
  const steps = [t("sectorStep"), t("businessRevenueStep"), t("rolesStep"), t("costsStep")];

  return (
    <Card className="p-5 sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
        <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">
          {draftError ? errors(draftError) : wizard("draftSaved")}
        </p>
      </div>
      <div
        aria-label={wizard("progress", { current: draft.step + 1, total: steps.length })}
        aria-valuemax={steps.length}
        aria-valuemin={1}
        aria-valuenow={draft.step + 1}
        className="mt-6 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{ width: `${((draft.step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        {steps.map((step, index) => (
          <span className={index === draft.step ? "font-semibold text-primary" : ""} key={step}>
            {step}
          </span>
        ))}
      </div>

      <form className="mt-8" onSubmit={saveDraft}>
        <fieldset className="space-y-5" ref={fieldsetRef}>
          <legend className="mb-5 text-lg font-semibold">{steps[draft.step]}</legend>

          {draft.step === 0 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="sector-search">
                  {t("searchLabel")}
                </label>
                <Input
                  id="sector-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  value={search}
                />
              </div>
              {filteredSectors.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredSectors.map((sector) => {
                    const selected = draft.sectorId === sector.id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`flex min-h-24 items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground"
                        }`}
                        key={sector.id}
                        onClick={() => chooseSector(sector)}
                        type="button"
                      >
                        <Icon
                          className="h-6 w-6 shrink-0"
                          name={iconByRevenueModel[sector.revenue_model_type]}
                        />
                        <span className="font-medium">{sector.names[locale]}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              )}
              {selectedSector ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="business-stage">
                      {t("stageLabel")}
                    </label>
                    <Select
                      id="business-stage"
                      onChange={(event) =>
                        updateDraft({
                          stage: z.enum(stageOptions).parse(event.target.value)
                        })
                      }
                      value={draft.stage}
                    >
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {t(`stages.${stage}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {selectedSector.id === "generic_other" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium" htmlFor="other-sector-description">
                        {t("otherDescription")}
                      </label>
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        id="other-sector-description"
                        maxLength={500}
                        onChange={(event) =>
                          updateDraft({ otherDescription: event.target.value })
                        }
                        placeholder={t("otherDescriptionPlaceholder")}
                        required
                        value={draft.otherDescription}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.step === 1 && selectedSector ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="sector-business-name">
                  {t("businessName")}
                </label>
                <Input
                  id="sector-business-name"
                  maxLength={200}
                  onChange={(event) =>
                    updateValue("businessName", event.target.value)
                  }
                  required
                  value={draft.values.businessName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="sector-location">
                  {t("location")}
                </label>
                <Input
                  id="sector-location"
                  maxLength={300}
                  onChange={(event) => updateValue("location", event.target.value)}
                  required
                  value={draft.values.location}
                />
              </div>
              {revenueFields.map((field) => (
                <div className="space-y-2" key={field.key}>
                  <label className="text-sm font-medium" htmlFor={`revenue-${field.key}`}>
                    {t(`revenueFields.${field.label}`)}
                  </label>
                  <Input
                    id={`revenue-${field.key}`}
                    max={field.percent ? "100" : undefined}
                    min="0"
                    onChange={(event) =>
                      updateValue("revenue", {
                        ...draft.values.revenue,
                        [field.key]: event.target.value
                      })
                    }
                    step="any"
                    type="number"
                    value={draft.values.revenue[field.key] ?? ""}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {draft.step === 2 && selectedSector ? (
            <div className="space-y-5">
              {[
                ...draft.values.roles.map((role, index) => ({
                  role,
                  index,
                  kind: "roles" as const
                })),
                ...draft.values.customRoles.map((role, index) => ({
                  role,
                  index,
                  kind: "customRoles" as const
                }))
              ].map(({ role, index, kind }) => (
                <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3" key={`${kind}-${role.role}`}>
                  <p className="self-center text-sm font-medium">
                    {t("roleLabel", { role: humanize(role.role) })}
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`role-count-${kind}-${index}`}>
                      {t("employeeCount")}
                    </label>
                    <Input
                      id={`role-count-${kind}-${index}`}
                      min="0"
                      onChange={(event) =>
                        updateRole(kind, index, "employeeCount", event.target.value)
                      }
                      step="1"
                      type="number"
                      value={role.employeeCount}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`role-salary-${kind}-${index}`}>
                      {t("monthlySalary")}
                    </label>
                    <Input
                      id={`role-salary-${kind}-${index}`}
                      min="0"
                      onChange={(event) =>
                        updateRole(kind, index, "monthlySalary", event.target.value)
                      }
                      step="any"
                      type="number"
                      value={role.monthlySalary}
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                <Input
                  aria-label={t("customRole")}
                  onChange={(event) => setCustomRole(event.target.value)}
                  value={customRole}
                />
                <Button onClick={addCustomRole} type="button" variant="outline">
                  <Icon className="h-4 w-4" name="plus" />
                  {t("addRole")}
                </Button>
              </div>
            </div>
          ) : null}

          {draft.step === 3 && selectedSector ? (
            <div className="space-y-5">
              {draft.values.costs.map((cost, index) => (
                <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" key={cost.category}>
                  <p className="self-center text-sm font-medium">
                    {t("costCategoryLabel", { category: humanize(cost.category) })}
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`cost-${index}`}>
                      {t("monthlyCost")}
                    </label>
                    <Input
                      id={`cost-${index}`}
                      min="0"
                      onChange={(event) => {
                        const costs = [...draft.values.costs];
                        costs[index] = { ...cost, monthlyAmount: event.target.value };
                        updateValue("costs", costs);
                      }}
                      step="any"
                      type="number"
                      value={cost.monthlyAmount}
                    />
                  </div>
                </div>
              ))}
              {draft.values.customCosts.map((cost, index) => (
                <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" key={`custom-${index}`}>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`custom-cost-name-${index}`}>
                      {t("customCostName")}
                    </label>
                    <Input
                      id={`custom-cost-name-${index}`}
                      onChange={(event) => {
                        const customCosts = [...draft.values.customCosts];
                        customCosts[index] = { ...cost, name: event.target.value };
                        updateValue("customCosts", customCosts);
                      }}
                      value={cost.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`custom-cost-amount-${index}`}>
                      {t("monthlyCost")}
                    </label>
                    <Input
                      id={`custom-cost-amount-${index}`}
                      min="0"
                      onChange={(event) => {
                        const customCosts = [...draft.values.customCosts];
                        customCosts[index] = { ...cost, monthlyAmount: event.target.value };
                        updateValue("customCosts", customCosts);
                      }}
                      step="any"
                      type="number"
                      value={cost.monthlyAmount}
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">
                <Input
                  aria-label={t("customCost")}
                  onChange={(event) => setCustomCost(event.target.value)}
                  value={customCost}
                />
                <Button onClick={addCustomCost} type="button" variant="outline">
                  <Icon className="h-4 w-4" name="plus" />
                  {t("addCost")}
                </Button>
              </div>
              {savedPlanId ? (
                <p className="text-sm text-success" role="status">
                  {t("draftCreated", { id: savedPlanId })}
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        {saveError ? (
          <p className="mt-5 text-sm text-destructive" role="alert">
            {saveError === "sectorRequired"
              ? t("sectorRequired")
              : errors(saveError)}
          </p>
        ) : null}
        {isSaving ? (
          <p className="mt-5 text-sm text-muted-foreground" role="status">
            {t("saving")}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          <Button
            disabled={draft.step === 0 || isSaving}
            onClick={() =>
              setDraft((current) => ({ ...current, step: Math.max(0, current.step - 1) }))
            }
            type="button"
            variant="outline"
          >
            {wizard("back")}
          </Button>
          {draft.step < 3 ? (
            <Button onClick={advanceStep} type="button">
              {wizard("next")}
            </Button>
          ) : (
            <Button disabled={isSaving || Boolean(savedPlanId)} loading={isSaving} type="submit">
              {isSaving ? t("saving") : t("saveDraft")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
