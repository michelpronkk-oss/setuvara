import { redirect } from "next/navigation";

/** The Store became Commerce → Products. */
export default function CreatorStorePage() {
  redirect("/app/identity/creator/commerce/products");
}
