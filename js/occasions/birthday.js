export const birthday = {
  id: "birthday",
  name: "Birthday",
  formTitle: "Birthday Invitation",
  intro: "A graceful celebration centred on the guest of honour and their milestone.",
  kicker: "A beautiful year to celebrate",
  defaultTheme: "plum",
  themes: [
    ["plum", "Plum & Gold"],
    ["midnight", "Midnight Blue & Gold"],
    ["champagne", "Champagne & Ivory"],
    ["ruby", "Ruby & Antique Gold"],
    ["sage", "Sage & Champagne"]
  ],
  sections: [
    {
      title: "Guest of honour",
      hint: "The person and milestone at the heart of the celebration.",
      fields: [
        { name: "celebrant", label: "Guest of honour", value: "Ananya Kapoor", required: true },
        { name: "age", label: "Milestone age", type: "number", value: "30", optional: true }
      ]
    },
    {
      title: "Celebration details",
      hint: "When and where everyone should gather.",
      fields: [
        { name: "date", label: "Celebration date", type: "date", value: "2026-09-19", required: true },
        { name: "time", label: "Celebration time", type: "time", value: "19:30", required: true },
        { name: "venue", label: "Venue", value: "The Glasshouse", required: true },
        { name: "address", label: "Address", value: "Bengaluru, Karnataka", required: true }
      ]
    },
    {
      title: "Finishing touches",
      hint: "A few details that make the invitation feel personal.",
      fields: [
        { name: "host", label: "Hosted by", value: "The Kapoor Family", optional: true },
        { name: "dressCode", label: "Dress code", value: "Cocktail Elegance", optional: true },
        { name: "message", label: "Invitation message", type: "textarea", value: "Join us for an evening of warmth, laughter and beautiful memories.", required: true, wide: true },
        { name: "rsvp", label: "RSVP contact", value: "Rhea · 98765 43210", optional: true, wide: true }
      ]
    }
  ],
  build(values, helpers) {
    return {
      title: helpers.firstName(values.celebrant),
      subtitle: values.age ? `Celebrating ${values.age} wonderful years` : "A Birthday Celebration",
      message: values.message,
      rsvp: values.rsvp,
      documentTitle: `${values.celebrant} | Birthday Invitation`,
      details: [
        ["Date", helpers.fullDate(values.date)],
        ["Time", helpers.formatTime(values.time)],
        ["Venue", values.venue],
        ["Address", values.address],
        ["Hosted by", values.host],
        ["Dress code", values.dressCode]
      ]
    };
  }
};
