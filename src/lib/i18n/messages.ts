const messages = {
  en: {
    common: {
      home: "Home", identity: "Identity", liveContext: "Live Context", wallet: "Wallet",
      analytics: "Analytics", connections: "Connections", people: "People", passport: "Passport",
      signOut: "Sign out",
      save: "Save", saving: "Saving…", cancel: "Cancel", close: "Close", settings: "Settings",
      viewProfile: "View public profile", manageBilling: "Manage", seePlans: "See plans",
      modeSettings: "Mode settings", emailPreferences: "Email preferences", region: "Region",
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
      bookIntro: "Book intro", connected: "Connected", viewConnection: "View connection",
      youMet: "You met", claimSetuvara: "Claim your Setuvara", keepConnection: "Keep this connection, create your identity, and share yours next time.",
      tagline: "Your identity, your context. Shared with Setuvara.",
      about: "About", atTheEvent: "At the event", bookCall: "Book a call", showMyQr: "Show my QR",
      madeWith: "Made with Setuvara", allLinks: "All links", links: "Links",
      soundOn: "Sound on", soundOff: "Sound off", soundtrack: "Soundtrack", nowPlaying: "Now playing", onRepeat: "On repeat",
      soundtrackOf: "{mode} soundtrack", eventSaved: "{event} and the time are saved to the connection.",
      profileMark: "Earned Setuvara mark",
    },
    appearance: {
      title: "Appearance", intro: "Curated for {mode} Mode. Every change previews live.",
      theme: "Theme", tapToPreview: "Tap any theme to preview", layout: "Layout", colour: "Colour", image: "Image", more: "More",
      free: "Free", plus: "Plus", themeDefault: "Theme default", standard: "Standard {theme}",
      themes: { light: "Light", dark: "Dark", editorial: "Editorial", noir: "Noir", signal: "Signal", studio: "Studio" },
      layouts: { cover: "Cover", framed: "Framed", portrait: "Portrait", poster: "Poster", index: "Index", "full-portrait": "Full Portrait" },
      portrait: { controls: "Full Portrait controls", zoom: "Photo zoom", position: "Photo position", adjustFocus: "Adjust crop and focus", noPhoto: "Add a photo in Profile to make this layout your own.", nameSize: "Name size", sizes: { compact: "Compact", standard: "Standard", large: "Large", statement: "Statement" }, showUsername: "Show username", inkFinish: "Full Portrait uses an Ink finish for readable text." },
      intensities: { quiet: "Quiet", balanced: "Balanced", signal: "Signal" },
      images: { "full-bleed": "Full", portrait: "Portrait", compact: "Compact", frame: "Frame" },
      accents: { coral: "Coral", lime: "Lime", blue: "Blue", lilac: "Lilac", gold: "Gold" },
      custom: "Custom", customAccent: "Custom accent colour", accentLabel: "{name} accent", intensity: "Accent intensity",
      lowContrast: "Low contrast on this theme. We’ve added an edge to Connect.",
      surfaces: "Surfaces", surfacesSummary: "Cards · corners · buttons", links: "Links", soundtrack: "Soundtrack", qr: "QR & sharing",
      cards: "Cards", corners: "Corners", buttons: "Buttons", linkStyle: "Link style",
      cardStyles: { flat: "Flat", outline: "Outline", soft: "Soft", layered: "Layered", editorial: "Editorial" },
      radii: { sharp: "Sharp", subtle: "Subtle", soft: "Soft" },
      buttonStyles: { pill: "Pill", block: "Block", editorial: "Editorial", minimal: "Minimal" },
      linkStyles: { icons: "Icon row", list: "List", chips: "Chips", cards: "Cards" },
      soundStyles: { core: "Core", strip: "Strip", disc: "Disc", poster: "Poster" },
      qrStyles: { standard: "Standard", "accent-frame": "Accent frame", label: "Identity label", inverse: "Inverse", rounded: "Rounded" },
      editorialSharp: "Editorial keeps sharp corners.", adjustFocus: "Adjust focus point", noPhoto: "No photo yet. Initials sit on your accent.",
      noSoundtrack: "Add a soundtrack in Content to choose how it appears.",
      qrNote: "Premium styles surround the code. The code and its link never change.",
      previewing: "Previewing {name}", previewOnlyYou: "Only you can see this preview. Your public profile still shows {current}.",
      backToCurrent: "Back to current", applyWithPlus: "Apply with Plus", saveAppearance: "Save appearance", done: "Done",
      viewers: { owner: "Owner", visitor: "Visitor", connected: "Connected" }, previewAs: "Preview as", livePreview: "Live preview",
      controls: "Appearance controls", previewLabel: "Profile preview",
      sheetKicker: "SETUVARA PLUS", sheetTitle: "Make your identity feel like yours.",
      sheetTheme: "{name} is one of four premium themes. Plus also unlocks premium layouts, accent intensity, soundtrack and QR presentation, for every Mode.",
      sheetLayout: "{name} is a premium layout. Plus also unlocks premium themes, accent intensity, soundtrack and QR presentation, for every Mode.",
      sheetAdvanced: "Accent intensity, cards, corners, buttons and link styles let your colour lead or step back. Plus also unlocks premium themes and layouts, for every Mode.",
      sheetImage: "The Frame image treatment is part of Plus, with premium themes, layouts and presentation for every Mode.",
      sheetSoundtrack: "{name} soundtrack presentation is part of Plus. Adding and playing a soundtrack stays free.",
      sheetQr: "{name} QR presentation is part of Plus. The code and its link never change.",
      sheetRestore: "Your saved look comes back the moment Plus is active. Nothing to set up again.",
      sheetItems: { looks: "Premium themes & layouts", looksTag: "EVERY MODE", surfaces: "Accent intensity & surfaces", surfacesTag: "SAFE BY DEFAULT", presentation: "Soundtrack & QR presentation", presentationTag: "SAME LINK" },
      unlock: "Unlock with Plus", keepPreviewing: "Keep previewing", opening: "Opening…", monthly: "{price} / month", yearly: "{price} / year",
      reviewFirst: "You review the subscription before any payment.", billingFailed: "Billing could not open right now. Your plan is unchanged.",
      billingInterval: "Billing interval",
      savedBody: "Saved for when you return to Plus. Your profile shows {current} until then.",
      rowTheme: "Theme", rowLayout: "Layout", rowAccent: "Accent", rowSoundtrack: "Soundtrack", rowSurfaces: "Surfaces", rowQr: "QR", rowEarned: "Earned",
      kept: "{value} (kept)", unchanged: "unchanged", none: "None", restore: "Restore with Plus",
      restoreNote: "On re-upgrade, the saved theme, layout, accent and styles re-apply instantly. No reconfiguration. Earned treatments are never affected.",
      pendingApplied: "Your previewed look is live.", inactive: "Saved · returns with Plus", notAvailable: "Not with {theme}",
      earnedTitle: "Earned identity treatments", earnedBody: "Unlocked through real connections. They apply to every Mode.",
      equipped: "Equipped", equip: "Equip", locked: "Locked", unlocksAt: "Unlocks at {count} connections",
    },
    settings: {
      regionTitle: "Region", regionDescription: "Your region is stored separately and does not change Setuvara’s interface language.",
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
  }
} as const;

export type MessageDictionary = typeof messages.en;
export type MessageKey = keyof MessageDictionary;

export function getMessages(_locale?: string): MessageDictionary {
  void _locale;
  return messages.en;
}

export function getLanguage(_locale?: string): "en" {
  void _locale;
  return "en";
}
