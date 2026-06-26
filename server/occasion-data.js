const occasions = {
  wedding: {
    required: ["bride", "groom", "weddingDate", "weddingTime", "venue", "address"],
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
    defaults: {
      celebrant: "Ananya Kapoor",
      age: "30",
      date: "2026-09-19",
      time: "19:30",
      venue: "The Glasshouse",
      address: "Bengaluru, Karnataka",
      host: "The Kapoor Family",
      dressCode: "Cocktail Elegance",
      message: "Join us for an evening of warmth, laughter and beautiful memories.",
      rsvp: "Rhea · 98765 43210",
      palette: "plum"
    }
  },
  engagement: {
    required: ["partnerOne", "partnerTwo", "date", "time", "venue", "address", "message"],
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
  }
};

module.exports = { occasions };
