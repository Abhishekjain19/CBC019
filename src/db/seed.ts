import { db } from "./index";
import { place, profile, trip, tripMember, itinerary, stop, expense, expenseSplit } from "./schema";

export async function seedDatabase() {
  console.log("Seeding Voyara destinations: Goa, Coorg, Hampi...");

  const placesData = [
    // --- GOA ---
    {
      id: "goa-palolem-beach",
      name: "Palolem Beach",
      category: "beach",
      destination: "Goa",
      latitude: "15.0100",
      longitude: "74.0232",
      openingHours: "06:00-20:00",
      hoursConfidence: "verified",
      description: "Picturesque crescent bay flanked by coconut palms and beach huts.",
      popularityScore: 95,
      verified: true,
    },
    {
      id: "goa-fort-aguada",
      name: "Fort Aguada & Lighthouse",
      category: "heritage",
      destination: "Goa",
      latitude: "15.4925",
      longitude: "73.7736",
      openingHours: "09:30-17:30",
      hoursConfidence: "verified",
      description: "17th-century Portuguese fortress overlooking the Arabian Sea.",
      popularityScore: 92,
      verified: true,
    },
    {
      id: "goa-basilica-bom-jesus",
      name: "Basilica of Bom Jesus",
      category: "heritage",
      destination: "Goa",
      latitude: "15.5009",
      longitude: "73.9116",
      openingHours: "09:00-18:30",
      hoursConfidence: "verified",
      description: "UNESCO World Heritage Baroque church in Old Goa.",
      popularityScore: 90,
      verified: true,
    },
    {
      id: "goa-dudhsagar-falls",
      name: "Dudhsagar Waterfalls",
      category: "nature",
      destination: "Goa",
      latitude: "15.3144",
      longitude: "74.3143",
      openingHours: "07:00-16:00",
      hoursConfidence: "verified",
      description: "Four-tiered massive waterfall surrounded by deciduous rainforest.",
      popularityScore: 94,
      verified: true,
    },

    // --- COORG ---
    {
      id: "coorg-abbey-falls",
      name: "Abbey Falls",
      category: "nature",
      destination: "Coorg",
      latitude: "12.4534",
      longitude: "75.7183",
      openingHours: "09:00-17:00",
      hoursConfidence: "verified",
      description: "Cascade nestled between coffee plantations and spice estates.",
      popularityScore: 91,
      verified: true,
    },
    {
      id: "coorg-rajas-seat",
      name: "Raja's Seat Sunset Viewpoint",
      category: "viewpoint",
      destination: "Coorg",
      latitude: "12.4225",
      longitude: "75.7381",
      openingHours: "06:00-20:00",
      hoursConfidence: "verified",
      description: "Seasonal garden offering sweeping vistas of lush valleys at golden hour.",
      popularityScore: 89,
      verified: true,
    },
    {
      id: "coorg-namdroling-monastery",
      name: "Namdroling Golden Temple",
      category: "heritage",
      destination: "Coorg",
      latitude: "12.4533",
      longitude: "75.9667",
      openingHours: "09:00-18:00",
      hoursConfidence: "verified",
      description: "Magnificent Tibetan monastery known for 40ft gilded Buddha statues.",
      popularityScore: 93,
      verified: true,
    },

    // --- HAMPI ---
    {
      id: "hampi-virupaksha-temple",
      name: "Virupaksha Temple",
      category: "heritage",
      destination: "Hampi",
      latitude: "15.3353",
      longitude: "76.4600",
      openingHours: "06:00-18:00",
      hoursConfidence: "verified",
      description: "7th-century sanctuary with towering gopuram on the Tungabhadra River.",
      popularityScore: 96,
      verified: true,
    },
    {
      id: "hampi-vijaya-vittala-temple",
      name: "Vittala Temple & Stone Chariot",
      category: "heritage",
      destination: "Hampi",
      latitude: "15.3394",
      longitude: "76.4789",
      openingHours: "08:30-17:30",
      hoursConfidence: "verified",
      description: "Iconic stone chariot and musical pillars from the Vijayanagara Empire.",
      popularityScore: 98,
      verified: true,
    },
    {
      id: "hampi-matanga-hill",
      name: "Matanga Hill Sunrise Point",
      category: "viewpoint",
      destination: "Hampi",
      latitude: "15.3317",
      longitude: "76.4667",
      openingHours: "05:00-19:00",
      hoursConfidence: "verified",
      description: "Highest vantage point overlooking ancient ruins and boulder terrain.",
      popularityScore: 92,
      verified: true,
    },
  ];

  for (const p of placesData) {
    try {
      await db.insert(place).values(p).onConflictDoNothing();
    } catch {
      // ignore conflict if already exists
    }
  }

  console.log("Seeding complete: Curated places ready in Neon Database.");
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
