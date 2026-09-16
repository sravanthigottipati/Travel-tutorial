import { signIn } from "next-auth/react";

// Auth.js's client-side signIn() does its own fetch-CSRF-token-then-POST
// sequence, which can race against SessionProvider's own background
// session fetch (mounted at the app root — see src/app/providers.tsx) on a
// freshly loaded page: the CSRF cookie from one in-flight request hasn't
// always settled before the other fires, surfacing as a "MissingCSRF"
// error from next-auth's own internals. A human clicking "Log in" rarely
// hits this — the page has usually been sitting open for a moment first —
// but immediately after registration (signing in on a page that just
// mounted) it's a real, reproducible race, not a flake to paper over.
// One retry is enough: the second attempt's CSRF fetch has nothing left to
// race against.
export async function signInWithRetry(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const first = await signIn("credentials", { email, password, redirect: false });
  if (!first?.error) return first ?? {};

  await new Promise((resolve) => setTimeout(resolve, 300));
  return (await signIn("credentials", { email, password, redirect: false })) ?? {};
}
