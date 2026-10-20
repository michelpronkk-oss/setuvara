/** Privacy requests as people see them: a confirmation code and a plain status. */

export type PrivacyKind = "platform_deauthorize" | "platform_data_deletion" | "account_deletion";
export type PrivacyStatus = "received" | "processing" | "completed" | "no_data" | "failed" | "cancelled";

/** 20 characters from an unambiguous alphabet; Meta asks for an alphanumeric code. */
export const CONFIRMATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const confirmationCodePattern = /^[A-Z0-9]{20}$/;

export function normalizeConfirmationCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return confirmationCodePattern.test(code) ? code : null;
}

/** 4-4-4-4-4, easier to read aloud or copy. */
export const formatConfirmationCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;

export const KIND_LABEL: Record<PrivacyKind, string> = {
  platform_deauthorize: "Platform access removed",
  platform_data_deletion: "Platform data deletion",
  account_deletion: "Account deletion",
};

export const STATUS_LABEL: Record<PrivacyStatus, string> = {
  received: "Received",
  processing: "In progress",
  completed: "Completed",
  no_data: "Completed · nothing stored",
  failed: "Not finished yet",
  cancelled: "Cancelled",
};

export function statusExplanation(kind: PrivacyKind, status: PrivacyStatus) {
  if (status === "failed") return "Something stopped the deletion part-way, so we have not marked it as done. The platform sends the request again and we retry each time. If this status stays, write to us with this code.";
  if (status === "cancelled") return "This request was withdrawn. Nothing was deleted because of it.";
  if (kind === "account_deletion") {
    if (status === "completed") return "Your Setuvara account and the data tied to it have been deleted, apart from records we must keep by law.";
    return "We have your request. A person checks it before anything is deleted, because deleting an account cannot be undone and can affect a paid plan. We confirm by email to the account's address.";
  }
  if (status === "no_data") return "Setuvara held no connected account for this platform sign-in, so there was nothing to delete.";
  if (status === "completed") return kind === "platform_deauthorize"
    ? "The platform told us you removed Setuvara. We deleted the sign-in, its tokens and the profile details and counts we had read from it."
    : "We deleted the sign-in, its tokens and the profile details and counts Setuvara had read from that platform.";
  return "We have the request and are working on it.";
}
