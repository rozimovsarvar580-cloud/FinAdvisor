export type SocialProviderAvailability = {
  google: boolean;
  facebook: boolean;
};

export function getSocialProviderAvailability(): SocialProviderAvailability {
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    facebook: Boolean(
      process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    )
  };
}
