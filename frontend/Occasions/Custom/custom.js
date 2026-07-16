export const custom = {
  id: "custom",
  name: "Custom Event",
  formTitle: "Custom Event Invitation",
  intro: "Create a flexible invitation for Roka, baby shower, first-month ceremony, family gatherings, or any other celebration.",
  kicker: "You are warmly invited",
  defaultTheme: "champagne",
  defaultIcon: "lotus",
  icons: [
    ["lotus", "Lotus bloom"],
    ["diya", "Auspicious diya"],
    ["rings", "Rings"],
    ["couple", "Couple silhouette"],
    ["cake", "Celebration cake"],
    ["envelope", "Invitation seal"]
  ],
  themes: [
    ["champagne", "Champagne & Ivory"],
    ["rose", "Rose & Gold"],
    ["emerald", "Emerald & Gold"],
    ["midnight", "Midnight Blue & Gold"],
    ["sage", "Sage & Champagne"],
    ["lavender", "Lavender & Silver"]
  ],
  sections: [
    {
      title: "Occasion",
      hint: "Name the event in your own words.",
      fields: [
        { name: "eventType", label: "Event type", optional: true },
        { name: "eventName", label: "Invitation title", required: true }
      ]
    },
    {
      title: "Event details",
      hint: "When and where guests should arrive.",
      fields: [
        { name: "date", label: "Event date", type: "date", required: true },
        { name: "time", label: "Event time", type: "time", required: true },
        { name: "venue", label: "Venue", required: true },
        { name: "address", label: "Address", required: true }
      ]
    },
    {
      title: "Optional details",
      hint: "Add any extra context your guests may need.",
      fields: [
        { name: "host", label: "Hosted by", optional: true, wide: true },
        { name: "dressCode", label: "Dress code", optional: true },
        { name: "extraNote", label: "Extra note", optional: true, wide: true },
        { name: "message", label: "Invitation message", type: "textarea", required: true, wide: true },
        { name: "rsvp", label: "RSVP contact", optional: true, wide: true }
      ]
    }
  ],
  build(values, helpers) {
    return {
      title: values.eventName,
      subtitle: values.eventType || "A Special Celebration",
      message: values.message,
      rsvp: values.rsvp,
      documentTitle: `${values.eventName} | Invitation`,
      details: [
        ["Date", helpers.fullDate(values.date)],
        ["Time", helpers.formatTime(values.time)],
        ["Venue", values.venue],
        ["Address", values.address],
        ["Hosted by", values.host],
        ["Dress code", values.dressCode],
        ["Note", values.extraNote]
      ]
    };
  }
};
