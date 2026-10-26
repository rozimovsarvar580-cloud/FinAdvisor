import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InvestorVerificationQueue from "./InvestorVerificationQueue";

afterEach(() => vi.unstubAllGlobals());

describe("investor verification review queue", () => {
  it("sends admin decisions and updates the displayed status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "approved", review_note: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InvestorVerificationQueue accessToken="admin-token" initialItems={[{
      id: "verification-1", user_id: "investor-1", email: "investor@example.com", full_name: "Investor One", organization: null,
      country: "Uzbekistan", investment_thesis: "Support local restaurants", source_of_funds: "Investment fund",
      status: "submitted", review_note: null
    }]} labels={{ title: "Review", empty: "Empty", status: "Status", approve: "Approve", reject: "Reject", submitted: "Submitted", approved: "Approved", rejected: "Rejected" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/investor-verifications/verification-1", expect.objectContaining({
      method: "PATCH", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" })
    })));
    await waitFor(() => expect(screen.getByText("Status: Approved")).toBeTruthy());
  });
});
