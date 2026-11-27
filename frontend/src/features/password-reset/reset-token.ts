import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

/** 256 random bits in base64url without padding, as the backend issues them. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The token of the emailed link, from the URL fragment (`#token=...`), or undefined when the
 * fragment has none or it cannot be one. The fragment never reaches the server or its logs.
 */
export function readResetToken(hash: string): string | undefined {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token && TOKEN_PATTERN.test(token) ? token : undefined;
}

/**
 * Reads the token once, on arrival, and takes the fragment out of the address bar (replacing the
 * history entry) so it does not linger in the history, a shared screen or a copied link.
 */
export function useResetTokenFromFragment(): string | undefined {
  const router = useRouter();
  const [token] = useState(() => readResetToken(router.state.location.hash));
  useEffect(() => {
    const { hash, pathname, searchStr } = router.state.location;
    if (hash) router.history.replace(`${pathname}${searchStr}`);
  }, [router]);
  return token;
}
