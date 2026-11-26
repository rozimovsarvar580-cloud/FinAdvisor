import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: { accessToken: "owner-access-token" } }))
}));

vi.mock("next-auth/react", () => ({ useSession }));

import { SectorPlanWizard } from "./sector-plan-wizard";

const messages = { en: enMessages, ru: ruMessages, uz: uzMessages } as const;
const sectors = [
  {
    id: "restaurant_cafe",
    names: { en: "Restaurant or cafe", ru: "Ресторан или кафе", uz: "Restoran yoki kafe" },
    revenue_model_type: "capacity_utilization",
    cost_categories: ["ingredients", "rent"],
    staff_roles: ["cook", "server"]
  },
  {
    id: "retail_shop",
    names: { en: "Retail shop", ru: "Розничный магазин", uz: "Chakana savdo do‘koni" },
    revenue_model_type: "unit_sales",
    cost_categories: ["inventory_purchases", "rent"],
    staff_roles: ["cashier", "stock_clerk"]
  },
  {
    id: "generic_other",
    names: { en: "Other business", ru: "Другой бизнес", uz: "Boshqa biznes" },
    revenue_model_type: "project_based",
    cost_categories: ["services"],
    staff_roles: ["specialist"]
  }
];

function renderWizard(locale: "en" | "ru" | "uz" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale] as unknown as AbstractIntlMessages}
    >
      <SectorPlanWizard onGenerated={vi.fn()} />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  useSession.mockReset();
  useSession.mockReturnValue({ data: { accessToken: "owner-access-token" } });
});

describe("sector-aware plan wizard", () => {
  it.each([
    ["en", "What business is it?"],
    ["ru", "Какой у вас бизнес?"],
    ["uz", "Qaysi biznesni boshlamoqchisiz?"]
  ] as const)("renders in %s", async (locale, title) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sectors)));

    renderWizard(locale);

    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
  });

  it("searches sectors and collects the Other description and business stage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sectors)));
    renderWizard();

    const retail = await screen.findByRole("button", { name: "Retail shop" });
    fireEvent.change(screen.getByLabelText("Search business types"), {
      target: { value: "retail" }
    });
    expect(screen.getByRole("button", { name: "Retail shop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restaurant or cafe" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Search business types"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Other business" }));
    fireEvent.change(screen.getByLabelText("Business stage"), {
      target: { value: "growing" }
    });
    fireEvent.change(screen.getByLabelText("Briefly describe your business"), {
      target: { value: "A neighborhood repair service" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByLabelText("Business name")).toBeTruthy();
    expect(window.localStorage.getItem("finadvisor.sector-plan-draft")).toContain(
      "A neighborhood repair service"
    );
    expect(retail).toBeTruthy();
  });

  it("builds revenue, team, and costs from the sector and saves custom entries", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/sectors") return Promise.resolve(Response.json(sectors));
      return Promise.resolve(
        Response.json(
          { id: "plan-sector-draft" },
          { status: 201 }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWizard();

    fireEvent.click(await screen.findByRole("button", { name: "Retail shop" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText("Business name"), {
      target: { value: "Local shop" }
    });
    fireEvent.change(screen.getByLabelText("City or area"), {
      target: { value: "Tashkent" }
    });
    fireEvent.change(screen.getByLabelText("Units sold per month"), {
      target: { value: "120" }
    });
    fireEvent.change(screen.getByLabelText("Price per unit (UZS)"), {
      target: { value: "45000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByLabelText("New role name"), {
      target: { value: "Delivery helper" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByLabelText("Custom cost"), {
      target: { value: "Local delivery" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add cost" }));
    fireEvent.change(screen.getByLabelText("Cost name"), {
      target: { value: "Local delivery" }
    });
    fireEvent.change(screen.getByLabelText("Monthly amount (UZS)", { selector: "#custom-cost-amount-0" }), {
      target: { value: "800000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save business draft" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(request.sector_id).toBe("retail_shop");
    expect(request.inputs.revenue.units_per_month).toBe("120");
    expect(request.inputs.staff_roles).toContain("cashier");
    expect(request.inputs.staff.some((role: { role: string }) => role.role === "Delivery helper")).toBe(
      true
    );
    expect(request.inputs.custom_cost_lines[0]).toEqual({
      name: "Local delivery",
      monthly_amount: "800000"
    });
    expect(await screen.findByText(/Draft saved/)).toBeTruthy();
  });

  it("restores a generic wizard draft after a reload", async () => {
    window.localStorage.setItem(
      "finadvisor.sector-plan-draft",
      JSON.stringify({
        step: 1,
        sectorId: "retail_shop",
        stage: "operating",
        otherDescription: "",
        values: {
          businessName: "Restored shop",
          location: "Samarkand",
          revenue: { units_per_month: "75", price_per_unit: "18000" },
          roles: [{ role: "cashier", employeeCount: "1", monthlySalary: "0" }],
          customRoles: [],
          costs: [{ category: "rent", monthlyAmount: "1000000" }],
          customCosts: []
        }
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sectors)));

    renderWizard();

    expect(await screen.findByLabelText("Business name")).toHaveProperty(
      "value",
      "Restored shop"
    );
    expect(screen.getByLabelText("Units sold per month")).toHaveProperty("value", "75");
  });
});
