import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PlaceSummary {
  id: string;
  name: string;
  category: string;
  openingHours?: string | null;
  estCostPaise?: number;
}

export interface GeneratedStop {
  placeId: string;
  placeName: string;
  startTime: string;
  endTime: string;
  estCostPaise: number;
  notes: string;
}

export interface GeneratedDay {
  dayIndex: number;
  title: string;
  stops: GeneratedStop[];
}

export async function generateItineraryWithGemini(
  destination: string,
  tripType: string,
  daysCount: number,
  availablePlaces: PlaceSummary[],
  dailyStart: string = "09:00",
  dailyEnd: string = "21:00"
): Promise<GeneratedDay[]> {
  const apiKey = process.env.LLM_API_KEY;

  // Fallback if no API key or external service unreachable (NFR-03, FR-32)
  if (!apiKey || apiKey === "placeholder") {
    return generateDeterministicFallback(destination, daysCount, availablePlaces, dailyStart);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are the Voyara travel planning engine.
Generate a structured ${daysCount}-day itinerary for a ${tripType} trip to ${destination}.
Daily hours available: ${dailyStart} to ${dailyEnd}.

STRICT RULES:
1. You may ONLY choose from the following allow-listed place IDs:
${availablePlaces.map((p) => `- ID: "${p.id}", Name: "${p.name}", Category: "${p.category}", Hours: "${p.openingHours || 'all day'}"`).join("\n")}

2. Do NOT invent place IDs. Every stop must use an exact placeId from the list above.
3. Schedule 2 to 3 stops per day with realistic start and end times between ${dailyStart} and ${dailyEnd}.
4. Provide the output in valid JSON ONLY (no markdown fences, no surrounding text), using this exact schema:
[
  {
    "dayIndex": 1,
    "title": "Day title",
    "stops": [
      {
        "placeId": "id from list",
        "placeName": "exact name from list",
        "startTime": "09:30",
        "endTime": "12:00",
        "estCostPaise": 50000,
        "notes": "Helpful traveler recommendation"
      }
    ]
  }
]
`;

    const response = await model.generateContent(prompt);
    let text = response.response.text().trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsed: GeneratedDay[] = JSON.parse(text);

    // Validate that place IDs are allow-listed (FR-32, NFR-06)
    const validIds = new Set(availablePlaces.map((p) => p.id));
    for (const day of parsed) {
      day.stops = day.stops.filter((s) => validIds.has(s.placeId));
    }

    if (parsed.length > 0 && parsed[0].stops.length > 0) {
      return parsed;
    }

    return generateDeterministicFallback(destination, daysCount, availablePlaces, dailyStart);
  } catch (err) {
    console.warn("Gemini generation failed, falling back to deterministic planner:", err);
    return generateDeterministicFallback(destination, daysCount, availablePlaces, dailyStart);
  }
}

// Deterministic fallback (FR-32, NFR-03)
function generateDeterministicFallback(
  destination: string,
  daysCount: number,
  places: PlaceSummary[],
  dailyStart: string
): GeneratedDay[] {
  const result: GeneratedDay[] = [];
  const placesPerDay = Math.min(3, Math.max(1, Math.floor(places.length / daysCount)));

  for (let d = 1; d <= daysCount; d++) {
    const dayStops: GeneratedStop[] = [];
    const startIndex = (d - 1) * placesPerDay;

    let currentHour = parseInt(dailyStart.split(":")[0]) || 9;

    for (let s = 0; s < placesPerDay; s++) {
      const place = places[(startIndex + s) % places.length];
      const start = `${String(currentHour).padStart(2, "0")}:00`;
      const end = `${String(currentHour + 2).padStart(2, "0")}:30`;
      currentHour += 3;

      dayStops.push({
        placeId: place.id,
        placeName: place.name,
        startTime: start,
        endTime: end,
        estCostPaise: place.estCostPaise || 50000, // ₹500
        notes: `Explore ${place.name} at your own pace.`,
      });
    }

    result.push({
      dayIndex: d,
      title: `${destination} Day ${d}: Highlights`,
      stops: dayStops,
    });
  }

  return result;
}
