import { WalletExperience } from "@/components/app/wallet/wallet-experience";
import { WALLET_PUBLICLY_LAUNCHED } from "@/lib/wallet/launch";

export default function WalletPage() {
  return <WalletExperience walletPubliclyLaunched={WALLET_PUBLICLY_LAUNCHED} />;
}
