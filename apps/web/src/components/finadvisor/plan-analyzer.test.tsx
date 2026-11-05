import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { PlanAnalyzer } from "./plan-analyzer";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "plan-test-token" } })
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPlanAnalyzer() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <PlanAnalyzer />
    </NextIntlClientProvider>
  );
}

describe("plan analyzer", () => {
  it.each([
    ["plan.pdf", "application/pdf"],
    [
      "plan.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    [
      "plan.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ],
    ["plan.txt", "text/plain"]
  ])("accepts %s uploads", (filename, contentType) => {
    const { container } = renderPlanAnalyzer();
    const input = container.querySelector<HTMLInputElement>("#plan-document");
    if (!input) throw new Error("Plan document input is required");

    fireEvent.change(input, {
      target: {
        files: [new File(["business plan"], filename, { type: contentType })]
      }
    });

    expect(screen.getByText(filename)).toBeDefined();
  });

  it("maps the API readiness response into the displayed result", async () => {
    const response = {
      score: 90,
      criteria: [
        { key: "market_analysis", score: 20, max_score: 20, present: true },
        {
          key: "financial_projections",
          score: 20,
          max_score: 20,
          present: true
        },
        { key: "repayment_ability", score: 15, max_score: 15, present: true },
        { key: "risks", score: 15, max_score: 15, present: true },
        { key: "collateral", score: 10, max_score: 10, present: true },
        { key: "team", score: 10, max_score: 10, present: true },
        { key: "legal", score: 0, max_score: 10, present: false }
      ],
      missing_criteria: ["legal"],
      improvements: [
        {
          key: "legal",
          fix: "Add permit details.",
          rewritten_section: "[Describe permits.]"
        }
      ],
      word_count: 25,
      formula: "readiness formula"
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderPlanAnalyzer();
    const input = container.querySelector<HTMLInputElement>("#plan-document");
    if (!input) throw new Error("Plan document input is required");

    fireEvent.change(input, {
      target: {
        files: [new File(["business plan"], "plan.txt", { type: "text/plain" })]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze plan" }));

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Readiness score: 90 out of 100" })
      ).toBeDefined();
    });
    expect(screen.getAllByText("Legal and permits")).toHaveLength(3);
    expect(screen.getByText(/Add permit details\./)).toBeDefined();
    expect(screen.getByText(/\[Describe permits\.\]/)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plans/analyze",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer plan-test-token" }
      })
    );
  });

  it("shows the localized upgrade hint when the AI quota is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          detail: {
            code: "ai.daily_limit_reached",
            daily_limit: 10,
            upgrade_hint: "pro"
          }
        },
        { status: 429 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderPlanAnalyzer();
    const input = container.querySelector<HTMLInputElement>("#plan-document");
    if (!input) throw new Error("Plan document input is required");
    fireEvent.change(input, {
      target: {
        files: [new File(["business plan"], "plan.txt", { type: "text/plain" })]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze plan" }));

    expect(
      await screen.findByText(
        "Your daily AI request limit has been reached. Upgrade your plan for more requests."
      )
    ).toBeDefined();
  });
});
