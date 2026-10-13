const messages = {
  en: {
    common: {
      home: "Home", identity: "Identity", liveContext: "Live Context", wallet: "Wallet",
      analytics: "Analytics", connections: "Connections", people: "People", passport: "Passport",
      signOut: "Sign out",
      save: "Save", saving: "Saving…", cancel: "Cancel", close: "Close", settings: "Settings",
      viewProfile: "View public profile", manageBilling: "Manage", seePlans: "See plans",
      billing: "Billing", upgrade: "Upgrade",
      modeSettings: "Mode settings", emailPreferences: "Email preferences", region: "Region",
    },
    liveContext: {
      title: "Where are you meeting people?", description: "Choose the context that belongs to this moment. It stays separate from every Mode. While it is live, its label and end time show on your public profile; venue and city stay private.",
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
      eventSaved: "{event} and the time are saved to the connection.",
      profileMark: "Earned Setuvara mark",
      makeYours: "Make yours on Setuvara", makeYoursShort: "Make yours", live: "Live", until: "until {time}", today: "today",
      hasSoundtrack: "This identity has a soundtrack", enterWithSound: "Enter with sound", continueMuted: "Continue muted",
      platforms: "{count} platforms", muteSoundtrack: "Sound on. Mute.", playSoundtrack: "Muted. Turn sound on.", tapToPlay: "Tap to play sound",
      photoOf: "Photo of {name}", moreImages: "More images",
      scrollMore: "Scroll to see more", cueScroll: "Scroll", cueSwipe: "Swipe up", cueMore: "More below",
    },
    appearance: {
      title: "Appearance", pickYourLook: "Pick your look, {name}.", pickIntro: "One identity, ten ways to wear it. Equip a look per Mode; previews use your own photo.",
      equipDirection: "Equip a direction", personalize: "Personalize {name}", choose: "Choose", personalizeTab: "Personalize", more: "More", less: "Less",
      free: "Free", plus: "Plus", plusPreviewing: "Plus · previewing", equippedOn: "Equipped · {name}", modeEquipped: "{mode} · {name}",
      equippedToast: "{name} equipped for {mode}", resetToast: "Appearance reset · photo, bio, links, soundtrack untouched",
      reset: "Reset Appearance", resetNote: "Resets the look for this Mode only. Photo, bio, links, content, soundtrack, connections and Live Context stay as they are.",
      controls: "Appearance controls", previewLabel: "Profile preview", previewing: "Previewing {name}",
      previewOnlyYou: "Only you can see this preview. Your public profile still shows {current}.",
      backToCurrent: "Back to current", apply: "Apply", applyWithPlus: "Apply with Plus", done: "Done",
      viewers: { owner: "Owner", visitor: "Visitor", connected: "Connected" }, previewAs: "Preview as", livePreview: "Live preview",
      scrollCue: "Scroll cue", scrollCueNote: "The sign at the bottom of your photo that there is more below.",
      scrollCues: { auto: "Auto", off: "Off", glide: "Glide", rail: "Rail", orb: "Orb", mouse: "Mouse", beam: "Beam", cascade: "Cascade", caption: "Caption", cards: "Cards", swipe: "Swipe", credits: "Credits" },
      nameFont: "Name type", nameSize: "Name size", sizes: { compact: "Compact", standard: "Standard", large: "Large", statement: "Statement" },
      namePosition: "Name position", positions: { auto: "Auto · face-safe", top: "Top", bottom: "Bottom" },
      readability: "Readability", readabilities: { auto: "Auto", soft: "Soft", deep: "Deep" },
      alignment: "Alignment", alignments: { left: "Left", center: "Center" }, socials: "Social icons", socialPlacements: { name: "Under name", links: "In links", both: "Both" }, socialStyle: "Icon style", socialStyles: { rail: "Rail", row: "Row", compact: "Compact", hidden: "Hidden" },
      motion: "Motion", motions: { off: "Off", subtle: "Subtle", full: "Full" },
      soundtrack: "Soundtrack", soundPresentations: { ambient: "Ambient", minimal: "Minimal", featured: "Featured" },
      noSoundtrack: "Add a soundtrack in Content to choose how it appears.",
      zoom: "Photo zoom", slideSpeed: "Slideshow speed", slideSpeeds: { slow: "Slow", medium: "Medium", fast: "Fast" }, adjustFocus: "Adjust crop and face point", noPhoto: "No photo yet. Initials sit on your accent.",
      showUsername: "Show username", colour: "Accent", accents: { coral: "Coral", lime: "Lime", blue: "Blue", lilac: "Lilac", gold: "Gold" },
      custom: "Custom", customAccent: "Custom accent colour", accentLabel: "{name} accent",
      qr: "QR & sharing", qrStyles: { standard: "Standard", "accent-frame": "Accent frame", label: "Identity label", inverse: "Inverse", rounded: "Rounded" },
      qrNote: "Premium styles surround the code. The code and its link never change.",
      sheetKicker: "SETUVARA PLUS", sheetTitle: "Wear {name} on {mode}.", sheetTitleType: "Set your name in {name}.", sheetTitleGeneric: "Make your identity feel like yours.",
      sheetBody: "You already made it yours. Plus unlocks all ten Appearances, every name type, full motion, Featured sound and premium QR presentation, on every Mode. Connect, Live Context and your network are the same on every plan.",
      sheetRestore: "Your saved look comes back the moment Plus is active. Nothing to set up again.",
      getPlus: "Get Plus · {price}/month", getPlusYearly: "Get Plus · {price}/year", keepPreviewing: "Keep previewing", opening: "Opening…",
      orYearly: "Or {price}/year.", orMonthly: "Or {price}/month.", previewStays: "Your preview stays saved. Public profile still shows {current}.",
      reviewFirst: "You review the subscription before any payment.", billingFailed: "Billing could not open right now. Your plan is unchanged.",
      billingInterval: "Billing interval",
      savedBody: "{name} is saved for when you return to Plus. Your profile shows {current} until then.",
      restore: "Restore with Plus", pendingApplied: "Your previewed look is live.", inactive: "Saved · returns with Plus",
      earnedTitle: "Earned identity treatments", earnedBody: "Unlocked through real connections. They apply to every Mode.", rowEarned: "Earned",
      equipped: "Equipped", equip: "Equip", locked: "Locked", unlocksAt: "Unlocks at {count} connections", none: "None",
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
