import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

import KycPage from "./page";

afterEach(() => vi.unstubAllGlobals());

describe("investor verification profile", () => {
  it("loads and submits the investor profile", async () => {
    useSession.mockReturnValue({ data: { accessToken: "investor-token" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "not_submitted", profile: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "submitted", full_name: "Investor One" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KycPage />);
    await screen.findByRole("button", { name: "investors.kyc_submit" });

    fireEvent.change(screen.getByLabelText("investors.kyc_fullName"), { target: { value: "Investor One" } });
    fireEvent.change(screen.getByLabelText("investors.kyc_country"), { target: { value: "Uzbekistan" } });
    fireEvent.change(screen.getByLabelText("investors.kyc_investmentThesis"), { target: { value: "Support local restaurants" } });
    fireEvent.change(screen.getByLabelText("investors.kyc_sourceOfFunds"), { target: { value: "Investment fund capital" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "investors.kyc_submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/investors/kyc", expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ Authorization: "Bearer investor-token" }) })));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).agreement_accepted).toBe(true);
    await screen.findByText("investors.kyc_submitted");
  });
});
