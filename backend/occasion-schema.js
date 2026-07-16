/**
 * Shared occasion validation schema, API defaults, and publish identity rules.
 * The browser UI fetches these defaults from the API, while frontend modules keep
 * only presentation labels, layout hints, theme choices, and card rendering logic.
 */
const occasions = {
  wedding: {
    required: ["bride", "groom", "weddingDate", "weddingTime", "venue", "address"],
    titleFields: ["bride", "groom"],
    fingerprintFields: ["bride", "groom", "weddingDate", "weddingTime", "venue", "address"],
    defaults: {
      bride: "Aisha Sharma",
      groom: "Rohan Mehta",
      weddingDate: "2026-12-12",
      weddingTime: "19:00",
      venue: "The Grand Palace",
      address: "Jaipur, Rajasthan",
      haldiDate: "2026-12-10",
      haldiTime: "11:00",
      haldiVenue: "Home Garden",
      engagementDate: "2026-12-08",
      engagementTime: "18:00",
      engagementVenue: "Lake View Hall",
      theme: "maroon",
      message: "Together with our families, we joyfully invite you to celebrate our wedding!",
      rsvpName: "Priya",
      rsvpPhone: "99999 88888"
    }
  },
  birthday: {
    required: ["celebrant", "date", "time", "venue", "address", "message"],
    titleFields: ["celebrant"],
    titleSuffix: "'s Birthday",
    fingerprintFields: ["celebrant", "age", "date", "time", "venue", "address"],
    defaults: {
      celebrant: "Bheem Kapoor",
      age: "30",
      date: "2026-09-19",
      time: "19:30",
      venue: "The Glasshouse",
      address: "Bengaluru, Karnataka",
      host: "The Kapoor Family",
      dressCode: "Cocktail Elegance",
      message: "Join us for an evening of warmth, laughter and beautiful memories.",
      rsvp: "Arjun · 98765 43210",
      palette: "plum"
    }
  },
  engagement: {
    required: ["partnerOne", "partnerTwo", "date", "time", "venue", "address", "message"],
    titleFields: ["partnerOne", "partnerTwo"],
    fingerprintFields: ["partnerOne", "partnerTwo", "date", "time", "venue", "address"],
    defaults: {
      partnerOne: "Ishita Malhotra",
      partnerTwo: "Arjun Khanna",
      date: "2026-10-25",
      time: "18:30",
      venue: "The Rose Pavilion",
      address: "New Delhi",
      hosts: "The Malhotra & Khanna Families",
      message: "With joyful hearts, we invite you to celebrate the beginning of our forever.",
      rsvp: "Naina · 98111 22334",
      palette: "emerald"
    }
  },
  office: {
    required: ["company", "eventName", "date", "time", "venue", "address", "message"],
    titleFields: ["eventName"],
    fingerprintFields: ["company", "eventName", "date", "time", "venue", "address"],
    defaults: {
      company: "Northstar Technologies",
      eventName: "Annual Celebration 2026",
      date: "2026-12-18",
      time: "19:00",
      venue: "Skyline Ballroom",
      address: "Gurugram, Haryana",
      dressCode: "Business Formal",
      agenda: "Awards · Dinner · Music",
      message: "Join colleagues and friends as we celebrate the year's achievements and the people behind them.",
      rsvp: "People Team · events@northstar.example",
      palette: "navy"
    }
  },
  custom: {
    required: ["eventName", "date", "time", "venue", "address", "message"],
    titleFields: ["eventName"],
    fingerprintFields: ["eventName", "date", "time", "venue", "address"],
    defaults: {
      eventType: "Roka Ceremony",
      eventName: "A Special Celebration",
      date: "2026-11-21",
      time: "18:00",
      venue: "Celebration Hall",
      address: "Your City",
      host: "With love from our family",
      dressCode: "",
      extraNote: "Blessings and good wishes are warmly welcome.",
      message: "We joyfully invite you to celebrate this special occasion with us.",
      rsvp: "RSVP contact",
      palette: "champagne"
    }
  }
};

module.exports = { occasions };
