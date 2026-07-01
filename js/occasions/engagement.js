export const engagement = {
  id: "engagement",
  name: "Engagement",
  formTitle: "Engagement Invitation",
  intro: "A romantic announcement devoted to the couple and their new beginning.",
  kicker: "Together with their families",
  defaultTheme: "emerald",
  themes: [
    ["emerald", "Emerald & Gold"],
    ["rose", "Rose & Antique Gold"],
    ["midnight", "Midnight Blue & Gold"],
    ["lavender", "Lavender & Silver"],
    ["burgundy", "Burgundy & Champagne"]
  ],
  sections: [
    {
      title: "The couple",
      hint: "Names are shown prominently on the finished card.",
      fields: [
        { name: "partnerOne", label: "Partner one's name", required: true },
        { name: "partnerTwo", label: "Partner two's name", required: true }
      ]
    },
    {
      title: "Ceremony details",
      hint: "Share the date, time, and gathering place.",
      fields: [
        { name: "date", label: "Engagement date", type: "date", required: true },
        { name: "time", label: "Ceremony time", type: "time", required: true },
        { name: "venue", label: "Venue", required: true },
        { name: "address", label: "Address", required: true }
      ]
    },
    {
      title: "A personal note",
      hint: "Add the families, blessing, and response contact.",
      fields: [
        { name: "hosts", label: "Hosted by / families", optional: true, wide: true },
        { name: "message", label: "Invitation message", type: "textarea", required: true, wide: true },
        { name: "rsvp", label: "RSVP contact", optional: true, wide: true }
      ]
    }
  ],
  build(values, helpers) {
    return {
      title: `${helpers.firstName(values.partnerOne)} & ${helpers.firstName(values.partnerTwo)}`,
      subtitle: "Are getting engaged",
      message: values.message,
      rsvp: values.rsvp,
      documentTitle: `${helpers.firstName(values.partnerOne)} & ${helpers.firstName(values.partnerTwo)} | Engagement Invitation`,
      details: [
        ["Date", helpers.fullDate(values.date)],
        ["Time", helpers.formatTime(values.time)],
        ["Venue", values.venue],
        ["Address", values.address],
        ["With love from", values.hosts]
      ]
    };
  }
};
