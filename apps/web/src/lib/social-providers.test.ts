import { afterEach, describe, expect, it, vi } from "vitest";

import { getSocialProviderAvailability } from "./social-providers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSocialProviderAvailability", () => {
  it("reports availability only when both provider credentials exist", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    vi.stubEnv("FACEBOOK_CLIENT_ID", "facebook-id");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");

    expect(getSocialProviderAvailability()).toEqual({
      google: true,
      facebook: false
    });
  });

  it("does not expose provider credential values in its result", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "secret-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret-value");

    const availability = getSocialProviderAvailability();

    expect(availability).toEqual({ google: true, facebook: false });
    expect(JSON.stringify(availability)).not.toContain("secret");
  });
});
