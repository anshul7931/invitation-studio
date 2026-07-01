export const office = {
  id: "office",
  name: "Office Party",
  formTitle: "Office Party Invitation",
  intro: "A polished company invitation with clear, practical event information.",
  kicker: "You are invited",
  defaultTheme: "navy",
  themes: [
    ["navy", "Corporate Navy & Gold"],
    ["charcoal", "Charcoal & Brass"],
    ["emerald", "Emerald & Gold"],
    ["aubergine", "Aubergine & Copper"],
    ["slate", "Slate Blue & Silver"]
  ],
  sections: [
    {
      title: "Company & event",
      hint: "Set the identity and purpose of the gathering.",
      fields: [
        { name: "company", label: "Company / team name", required: true },
        { name: "eventName", label: "Event name", required: true }
      ]
    },
    {
      title: "Event logistics",
      hint: "The essential details for your guests.",
      fields: [
        { name: "date", label: "Event date", type: "date", required: true },
        { name: "time", label: "Event time", type: "time", required: true },
        { name: "venue", label: "Venue", required: true },
        { name: "address", label: "Address", required: true }
      ]
    },
    {
      title: "Guest information",
      hint: "Optional guidance and the invitation message.",
      fields: [
        { name: "dressCode", label: "Dress code", optional: true },
        { name: "agenda", label: "Highlights / agenda", optional: true },
        { name: "message", label: "Invitation message", type: "textarea", required: true, wide: true },
        { name: "rsvp", label: "RSVP / event contact", optional: true, wide: true }
      ]
    }
  ],
  build(values, helpers) {
    return {
      title: values.eventName,
      subtitle: values.company,
      message: values.message,
      rsvp: values.rsvp,
      documentTitle: `${values.eventName} | Office Party Invitation`,
      details: [
        ["Date", helpers.fullDate(values.date)],
        ["Time", helpers.formatTime(values.time)],
        ["Venue", values.venue],
        ["Address", values.address],
        ["Dress code", values.dressCode],
        ["Evening highlights", values.agenda]
      ]
    };
  }
};
