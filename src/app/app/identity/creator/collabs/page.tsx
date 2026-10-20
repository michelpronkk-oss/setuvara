import { redirect } from "next/navigation";

/** Collabs moved into Actions: collaboration requests are now an Action with its own inbox. */
export default function CreatorCollabsPage() {
  redirect("/app/identity/creator/actions");
}
