"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

type UserRole = "tadbirkor" | "buxgalter" | "investor" | "admin";
type Locale = "uz" | "ru" | "en";
type Profile = {
  email: string;
  name: string;
  role: UserRole;
  locale: Locale;
  deletion_requested_at: string | null;
};
type ConnectedAccount = {
  provider: "google" | "facebook";
  connected_at: string;
};

const availableLocales: Locale[] = ["uz", "ru", "en"];

export function ProfileSettings() {
  const t = useTranslations("landing.hero.profileSettings");
  const roleMessages = useTranslations("auth.roles");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [name, setName] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<Locale>(locale);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [consentToDeletionRequest, setConsentToDeletionRequest] =
    useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const [profileResponse, accountsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/auth/me/accounts", { cache: "no-store" })
        ]);
        if (!profileResponse.ok || !accountsResponse.ok) {
          throw new Error("profile_load_failed");
        }
        const [profileData, accountsData] = await Promise.all([
          profileResponse.json() as Promise<Profile>,
          accountsResponse.json() as Promise<ConnectedAccount[]>
        ]);
        if (active) {
          setProfile(profileData);
          setAccounts(accountsData);
          setName(profileData.name);
          setPreferredLocale(profileData.locale);
        }
      } catch (loadError) {
        if (loadError instanceof TypeError || loadError instanceof SyntaxError) {
          if (active) setError(t("loadFailed"));
          return;
        }
        throw loadError;
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [t]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setError("");
    setProfileMessage("");
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, locale: preferredLocale })
      });
      if (!response.ok) {
        setError(t("profileSaveFailed"));
        return;
      }
      const updatedProfile = (await response.json()) as Profile;
      setProfile(updatedProfile);
      await update();
      setProfileMessage(t("profileSaved"));
      if (preferredLocale !== locale) {
        router.replace("/dashboard/settings", { locale: preferredLocale });
      }
    } catch (saveError) {
      if (saveError instanceof TypeError || saveError instanceof SyntaxError) {
        setError(t("profileSaveFailed"));
        return;
      }
      throw saveError;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      if (!response.ok) {
        setError(
          response.status === 400
            ? t("currentPasswordIncorrect")
            : t("passwordChangeFailed")
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(t("passwordChanged"));
    } catch (passwordError) {
      if (
        passwordError instanceof TypeError ||
        passwordError instanceof SyntaxError
      ) {
        setError(t("passwordChangeFailed"));
        return;
      }
      throw passwordError;
    } finally {
      setIsChangingPassword(false);
    }
  };

  const requestDeletion = async () => {
    setIsRequestingDeletion(true);
    setError("");
    setDeletionMessage("");
    try {
      const response = await fetch("/api/auth/me/deletion-request", {
        method: "POST"
      });
      if (!response.ok) {
        setError(t("deletionRequestFailed"));
        return;
      }
      const updatedProfile = (await response.json()) as Profile;
      setProfile(updatedProfile);
      setConsentToDeletionRequest(false);
      setDeletionMessage(t("deletionRequestSaved"));
    } catch (deletionError) {
      if (
        deletionError instanceof TypeError ||
        deletionError instanceof SyntaxError
      ) {
        setError(t("deletionRequestFailed"));
        return;
      }
      throw deletionError;
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("loading")}
      </p>
    );
  }

  if (!profile) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error || t("loadFailed")}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">{t("profileTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("role")}: {roleMessages(profile.role)}
        </p>
        <form className="mt-5 space-y-4" onSubmit={saveProfile}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="profile-name">
              {t("name")}
            </label>
            <Input
              autoComplete="name"
              id="profile-name"
              maxLength={200}
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="profile-locale">
              {t("language")}
            </label>
            <Select
              id="profile-locale"
              onChange={(event) =>
                setPreferredLocale(event.target.value as Locale)
              }
              value={preferredLocale}
            >
              {availableLocales.map((localeCode) => (
                <option key={localeCode} value={localeCode}>
                  {t(`localeNames.${localeCode}`)}
                </option>
              ))}
            </Select>
          </div>
          {profileMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {profileMessage}
            </p>
          ) : null}
          <Button disabled={isSavingProfile} loading={isSavingProfile} type="submit">
            {isSavingProfile ? t("saving") : t("saveProfile")}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">{t("connectedAccounts")}</h2>
        {accounts.length ? (
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                key={account.provider}
              >
                <span>{t(`providers.${account.provider}`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t("connected")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("noConnectedAccounts")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">{t("passwordTitle")}</h2>
        <form className="mt-5 space-y-4" onSubmit={changePassword}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="current-password">
              {t("currentPassword")}
            </label>
            <Input
              autoComplete="current-password"
              id="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="new-password">
              {t("newPassword")}
            </label>
            <Input
              autoComplete="new-password"
              id="new-password"
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="confirm-password"
            >
              {t("confirmPassword")}
            </label>
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </div>
          {passwordMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {passwordMessage}
            </p>
          ) : null}
          <Button
            disabled={isChangingPassword}
            loading={isChangingPassword}
            type="submit"
          >
            {isChangingPassword ? t("changingPassword") : t("changePassword")}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-card p-6">
        <h2 className="text-xl font-semibold">{t("deleteAccountTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("deleteAccountDescription")}
        </p>
        {profile.deletion_requested_at ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {deletionMessage || t("deletionRequestExists")}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                checked={consentToDeletionRequest}
                className="mt-0.5 h-4 w-4 accent-primary"
                onChange={(event) =>
                  setConsentToDeletionRequest(event.target.checked)
                }
                type="checkbox"
              />
              <span>{t("confirmDeletionRequest")}</span>
            </label>
            {deletionMessage ? (
              <p className="text-sm text-muted-foreground" role="status">
                {deletionMessage}
              </p>
            ) : null}
            <Button
              disabled={!consentToDeletionRequest || isRequestingDeletion}
              loading={isRequestingDeletion}
              onClick={requestDeletion}
              type="button"
              variant="destructive"
            >
              {isRequestingDeletion ? t("requestingDeletion") : t("requestDeletion")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
