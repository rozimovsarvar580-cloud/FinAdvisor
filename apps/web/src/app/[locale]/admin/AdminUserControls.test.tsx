import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminUserControls from "./AdminUserControls";

afterEach(() => vi.unstubAllGlobals());

describe("AdminUserControls", () => {
  it("updates a user's role through the admin API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminUserControls rows={[{ id: "u1", email: "a@example.com", role: "tadbirkor", is_suspended: false, subscription_plan: "free" }]} token="admin-token" apiUrl="https://api.test" labels={{ role: "Role", suspend: "Suspend", unsuspend: "Restore", saved: "Saving", roles: { tadbirkor: "Owner", buxgalter: "Accountant", investor: "Investor" } }} />);
    fireEvent.change(screen.getByLabelText("Role: a@example.com"), { target: { value: "investor" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("https://api.test/admin/users/u1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "investor" }) })));
  });
});

