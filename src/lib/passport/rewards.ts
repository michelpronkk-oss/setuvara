export type RewardCategory = "profile_treatment" | "accent" | "share_treatment" | "qr_frame" | "passport_cover" | "passport_stamp_style" | "profile_mark";
export type RewardRarity = "common" | "uncommon" | "rare" | "signature" | "legendary";

export const MILESTONES = [
  { threshold: 5, name: "First Circle", label: "FIRST CIRCLE" },
  { threshold: 10, name: "Ten Met", label: "TEN MET" },
  { threshold: 25, name: "In Motion", label: "IN MOTION" },
  { threshold: 50, name: "Signal 50", label: "SIGNAL 50" },
  { threshold: 100, name: "Century", label: "CENTURY" },
  { threshold: 250, name: "Connector", label: "CONNECTOR" },
  { threshold: 500, name: "Network 500", label: "NETWORK 500" },
  { threshold: 1000, name: "Thousand Met", label: "THOUSAND MET" },
] as const;

export type PassportReward = {
  id: string;
  name: string;
  description: string;
  category: RewardCategory;
  milestone: number;
  rarity: RewardRarity;
  sortOrder: number;
};

// This registry is the UI's canonical reward catalog. The database migration
// mirrors these immutable entitlement IDs so RLS/RPC can enforce selection.
export const PASSPORT_REWARDS: readonly PassportReward[] = [
  { id: "first_circle_stamp", name: "First Circle", description: "A keepsake for the first five people in your network.", category: "passport_stamp_style", milestone: 5, rarity: "common", sortOrder: 5 },
  { id: "paper_passport_cover", name: "Paper Passport", description: "A warm paper cover for your private Passport.", category: "passport_cover", milestone: 5, rarity: "common", sortOrder: 10 },
  { id: "signal_accent", name: "Signal Accent", description: "A clear coral note across your public identity.", category: "accent", milestone: 10, rarity: "uncommon", sortOrder: 20 },
  { id: "signal_share", name: "Signal Share", description: "A coral share treatment for the moment you meet.", category: "share_treatment", milestone: 10, rarity: "uncommon", sortOrder: 25 },
  { id: "editorial_profile", name: "Editorial Profile", description: "A quieter, more editorial profile treatment.", category: "profile_treatment", milestone: 25, rarity: "rare", sortOrder: 30 },
  { id: "signal_50_mark", name: "Signal 50", description: "A small signature mark earned through real connections.", category: "profile_mark", milestone: 50, rarity: "signature", sortOrder: 40 },
  { id: "coral_qr_frame", name: "Coral Frame", description: "A coral frame around your scannable QR.", category: "qr_frame", milestone: 50, rarity: "signature", sortOrder: 45 },
  { id: "century_cover", name: "Century Cover", description: "A deeper cover for a growing Passport.", category: "passport_cover", milestone: 100, rarity: "rare", sortOrder: 50 },
  { id: "century_profile", name: "Century Profile", description: "A more considered editorial profile treatment.", category: "profile_treatment", milestone: 100, rarity: "rare", sortOrder: 55 },
  { id: "connector_treatment", name: "Connector", description: "An identity treatment earned through a wide network.", category: "profile_treatment", milestone: 250, rarity: "signature", sortOrder: 60 },
  { id: "network_share", name: "Network Share", description: "A distinctive Share screen treatment.", category: "share_treatment", milestone: 500, rarity: "legendary", sortOrder: 70 },
  { id: "thousand_mark", name: "Thousand Met", description: "A rare Setuvara profile mark.", category: "profile_mark", milestone: 1000, rarity: "legendary", sortOrder: 80 },
  { id: "thousand_cover", name: "Thousand Cover", description: "The highest V1 Passport cover.", category: "passport_cover", milestone: 1000, rarity: "legendary", sortOrder: 90 },
];

export function rewardsFor(category: RewardCategory) {
  return PASSPORT_REWARDS.filter((reward) => reward.category === category);
}