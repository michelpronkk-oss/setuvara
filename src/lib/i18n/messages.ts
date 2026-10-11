import { languageFor, type Language, type Locale } from "./locale";

const messages = {
  en: {
    common: {
      home: "Home", identity: "Identity", liveContext: "Live Context", wallet: "Wallet",
      analytics: "Analytics", connections: "Connections", people: "People", passport: "Passport",
      language: "Language", english: "English", dutch: "Nederlands", signOut: "Sign out",
      save: "Save", saving: "Saving…", cancel: "Cancel", close: "Close", settings: "Settings",
      viewProfile: "View public profile", manageBilling: "Manage", seePlans: "See plans",
      modeSettings: "Mode settings", emailPreferences: "Email preferences",
    },
    liveContext: {
      title: "Where are you meeting people?", description: "Choose the context that belongs to this moment. It stays separate from every Mode.",
      active: "Active now", none: "No active context", empty: "Add a Live Context when you want a moment to be remembered.",
      type: { event: "Event", meeting: "Meeting", place: "Place", custom: "Custom" },
      label: "Name this context", labelHint: "For example, Web Summit or Acme catch-up", venue: "Venue (optional)",
      city: "City (optional)", country: "Country (optional)", startsAt: "Starts (optional)", expiresAt: "Ends",
      setActive: "Set active context", replace: "Replace active context", end: "End context", save: "Save context",
      expired: "This context has expired and is no longer used for new Connections.",
      noLocation: "No location added. The context can still be saved.",
      saved: "Saved for later", recent: "Recent contexts", savedContexts: "Saved contexts",
      error: "This context could not be saved. Check the details and try again.",
      ended: "Live Context ended.",
    },
    profile: {
      personalMode: "Personal Mode", eventMode: "Event Mode", businessMode: "Business Mode",
      share: "Share", editMode: "Edit Mode", previewVisitor: "Preview as visitor",
      connect: "Connect", viewingProfile: "Viewing this profile", visit: "Visit link",
      editPersonal: "Edit Personal Mode", editEvent: "Edit Event Mode", editBusiness: "Edit Business Mode",
      shareMode: "Share {mode} Mode", showQr: "Show QR code", noLinks: "No links shared in this Mode yet.",
      eventReady: "Event Mode is ready when you are.", nextEvent: "Your next event", hereToMeet: "Here to meet",
      saveContact: "Save contact", bookIntro: "Book intro", connected: "Connected", viewConnection: "View connection",
      youMet: "You met", claimSetuvara: "Claim your Setuvara", keepConnection: "Keep this connection, create your identity, and share yours next time.",
      tagline: "Your identity, your context. Shared with Setuvara.",
    },
    settings: {
      languageTitle: "Language", languageDescription: "Choose the language Setuvara uses for its interface.",
      saved: "Your language preference is saved.", error: "Your language preference could not be saved. Try again.",
      regionTitle: "Region", regionDescription: "Your region is separate from your language preference.",
    },
    marketing: {
      product: "Product", modes: "Modes", events: "For Events", teams: "For Teams", pricing: "Pricing",
      login: "Log in", getSetuvara: "Get Setuvara", createSetuvara: "Create your Setuvara",
      oneIdentity: "One identity. Every version of you.", yourIdentity: "Your identity. Your connections.",
      shareConnect: "Share & Connect", roadmap: "Roadmap", account: "Account", setuvaraFor: "Setuvara for",
      connections: "Connections", passport: "Passport", meetOnce: "Meet once. Stay connected.",
    },
    encounter: {
      liveContext: "Live Context", modeShared: "Mode shared", contextUnknown: "No context was set for this Encounter.",
      addWhereWhen: "Add where & when", privateMemory: "Private memory · only you",
      event: "Event", meeting: "Meeting", place: "Place", custom: "Custom",
    },
  },
  nl: {
    common: {
      home: "Home", identity: "Identiteit", liveContext: "Live context", wallet: "Wallet",
      analytics: "Inzichten", connections: "Connecties", people: "Mensen", passport: "Passport",
      language: "Taal", english: "English", dutch: "Nederlands", signOut: "Uitloggen",
      save: "Opslaan", saving: "Opslaan…", cancel: "Annuleren", close: "Sluiten", settings: "Instellingen",
      viewProfile: "Bekijk openbaar profiel", manageBilling: "Beheren", seePlans: "Bekijk abonnementen",
      modeSettings: "Mode-instellingen", emailPreferences: "E-mailvoorkeuren",
    },
    liveContext: {
      title: "Waar ontmoet je mensen?", description: "Kies de context voor dit moment. Die staat los van elke Mode.",
      active: "Nu actief", none: "Geen actieve context", empty: "Voeg een live context toe als je dit moment wilt onthouden.",
      type: { event: "Evenement", meeting: "Afspraak", place: "Plek", custom: "Anders" },
      label: "Geef deze context een naam", labelHint: "Bijvoorbeeld Web Summit of afspraak met Acme", venue: "Locatie (optioneel)",
      city: "Stad (optioneel)", country: "Land (optioneel)", startsAt: "Begint (optioneel)", expiresAt: "Eindigt",
      setActive: "Context activeren", replace: "Actieve context vervangen", end: "Context beëindigen", save: "Context opslaan",
      expired: "Deze context is verlopen en wordt niet gebruikt voor nieuwe Connecties.",
      noLocation: "Geen locatie toegevoegd. Je kunt de context wel opslaan.",
      saved: "Bewaard voor later", recent: "Recente contexten", savedContexts: "Bewaarde contexten",
      error: "Deze context kon niet worden opgeslagen. Controleer de gegevens en probeer het opnieuw.",
      ended: "Live context beëindigd.",
    },
    profile: {
      personalMode: "Personal Mode", eventMode: "Event Mode", businessMode: "Business Mode",
      share: "Delen", editMode: "Mode bewerken", previewVisitor: "Bekijken als bezoeker",
      connect: "Verbinden", viewingProfile: "Je bekijkt dit profiel", visit: "Link openen",
      editPersonal: "Personal Mode bewerken", editEvent: "Event Mode bewerken", editBusiness: "Business Mode bewerken",
      shareMode: "Deel {mode} Mode", showQr: "QR-code tonen", noLinks: "Er zijn nog geen links gedeeld in deze Mode.",
      eventReady: "Event Mode staat klaar wanneer jij dat bent.", nextEvent: "Je volgende evenement", hereToMeet: "Ik wil ontmoeten",
      saveContact: "Contact opslaan", bookIntro: "Plan een kennismaking", connected: "Verbonden", viewConnection: "Bekijk connectie",
      youMet: "Jullie ontmoetten elkaar", claimSetuvara: "Claim je Setuvara", keepConnection: "Bewaar deze connectie, maak je identiteit aan en deel die de volgende keer.",
      tagline: "Jouw identiteit, jouw context. Gedeeld met Setuvara.",
    },
    settings: {
      languageTitle: "Taal", languageDescription: "Kies de taal voor de Setuvara-interface.",
      saved: "Je taalvoorkeur is opgeslagen.", error: "Je taalvoorkeur kon niet worden opgeslagen. Probeer het opnieuw.",
      regionTitle: "Regio", regionDescription: "Je regio staat los van je taalvoorkeur.",
    },
    marketing: {
      product: "Product", modes: "Modes", events: "Voor evenementen", teams: "Voor teams", pricing: "Prijzen",
      login: "Inloggen", getSetuvara: "Ontdek Setuvara", createSetuvara: "Maak je Setuvara",
      oneIdentity: "Eén identiteit. Elke kant van jou.", yourIdentity: "Jouw identiteit. Jouw connecties.",
      shareConnect: "Delen & verbinden", roadmap: "Roadmap", account: "Account", setuvaraFor: "Setuvara voor",
      connections: "Connecties", passport: "Passport", meetOnce: "Ontmoet. Blijf verbonden.",
    },
    encounter: {
      liveContext: "Live context", modeShared: "Gedeelde Mode", contextUnknown: "Er was geen context ingesteld voor deze ontmoeting.",
      addWhereWhen: "Voeg plek en moment toe", privateMemory: "Privéherinnering · alleen voor jou",
      event: "Evenement", meeting: "Afspraak", place: "Plek", custom: "Anders",
    },
  },
} as const;

export type MessageDictionary = typeof messages.en;
export type MessageKey = keyof MessageDictionary;

export function getMessages(locale: Locale | string): MessageDictionary {
  return messages[languageFor(locale)] as MessageDictionary;
}

export function getLanguage(locale: Locale | string): Language {
  return languageFor(locale);
}
