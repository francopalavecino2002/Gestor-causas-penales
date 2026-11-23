import { useMe } from "@/features/auth/me-query";
import { IMPORT_ROLES } from "@/features/imports/import-copy";

/**
 * Only the owner and lawyers import; the backend enforces the same rule (`403`). The signed-in
 * layout awaits `me` in its `beforeLoad` (router.tsx), so it is already loaded here and the
 * `false` fallback never flashes a "no permission" state.
 */
export function useCanImport(): boolean {
  const { data: me } = useMe();
  return me ? IMPORT_ROLES.includes(me.role) : false;
}
