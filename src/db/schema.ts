import { pgTable, text, integer, timestamp, boolean, varchar, uuid, primaryKey } from "drizzle-orm/pg-core";

// 1. Profile Table (tied to Neon Auth user_id)
export const profile = pgTable("profile", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  displayName: text("display_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  vibeTags: text("vibe_tags"), // JSON stringified array of tags
  pace: varchar("pace", { length: 50 }).default("moderate"), // relaxed, moderate, fast
  budgetLevel: varchar("budget_level", { length: 50 }).default("medium"), // budget, medium, luxury
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Trip Table
export const trip = pgTable("trip", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: varchar("owner_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // solo, family, group
  peopleCount: integer("people_count").default(1).notNull(),
  destination: text("destination").notNull(),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  dailyStart: text("daily_start").default("09:00").notNull(),
  dailyEnd: text("daily_end").default("21:00").notNull(),
  transportMode: varchar("transport_mode", { length: 50 }).default("driving").notNull(),
  budgetPaise: integer("budget_paise").default(0).notNull(), // stored in integer paise
  status: varchar("status", { length: 50 }).default("planning").notNull(), // planning, confirmed, live, completed, archived
  joinCode: varchar("join_code", { length: 8 }).unique(), // 8-char secure code
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. Trip Member Table
export const tripMember = pgTable("trip_member", {
  tripId: uuid("trip_id").references(() => trip.id).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("member").notNull(), // owner, member
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  removedAt: timestamp("removed_at"),
}, (table) => [
  primaryKey({ columns: [table.tripId, table.userId] }),
]);

// 4. Place Table
export const place = pgTable("place", {
  id: varchar("id", { length: 120 }).primaryKey(),
  name: text("name").notNull(),
  category: varchar("category", { length: 80 }).notNull(), // beach, heritage, dining, viewpoint, nature
  destination: varchar("destination", { length: 80 }).notNull(), // Goa, Coorg, Hampi
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  source: varchar("source", { length: 50 }).default("curated"),
  openingHours: text("opening_hours"), // e.g. "09:00-18:00"
  hoursConfidence: varchar("hours_confidence", { length: 50 }).default("verified"), // verified, estimated, unknown
  description: text("description"),
  imageUrl: text("image_url"),
  popularityScore: integer("popularity_score").default(85),
  verified: boolean("verified").default(true),
});

// 5. Itinerary Table
export const itinerary = pgTable("itinerary", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trip.id).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, confirmed
  version: integer("version").default(1).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 6. Stop Table
export const stop = pgTable("stop", {
  id: uuid("id").defaultRandom().primaryKey(),
  itineraryId: uuid("itinerary_id").references(() => itinerary.id).notNull(),
  placeId: varchar("place_id", { length: 120 }).references(() => place.id).notNull(),
  dayIndex: integer("day_index").notNull(), // 1-indexed
  startTime: text("start_time").notNull(), // "10:00"
  endTime: text("end_time").notNull(), // "12:00"
  sortOrder: integer("sort_order").notNull(),
  estCostPaise: integer("est_cost_paise").default(0).notNull(),
  notes: text("notes"),
});

// 7. Route Cache Table
export const routeCache = pgTable("route_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  originKey: text("origin_key").notNull(),
  destinationKey: text("destination_key").notNull(),
  mode: varchar("mode", { length: 50 }).default("driving").notNull(),
  durationS: integer("duration_s").notNull(),
  distanceM: integer("distance_m").notNull(),
  source: varchar("source", { length: 50 }).default("ors"),
  isApproximate: boolean("is_approximate").default(false),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// 8. Expense Table
export const expense = pgTable("expense", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trip.id).notNull(),
  payerId: varchar("payer_id", { length: 255 }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  category: varchar("category", { length: 80 }).notNull(), // food, stay, transit, activity, misc
  note: text("note"),
  spentAt: timestamp("spent_at").defaultNow().notNull(),
  splitType: varchar("split_type", { length: 50 }).default("equal").notNull(), // equal, exact
  version: integer("version").default(1).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 9. Expense Split Table
export const expenseSplit = pgTable("expense_split", {
  expenseId: uuid("expense_id").references(() => expense.id).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  sharePaise: integer("share_paise").notNull(),
}, (table) => [
  primaryKey({ columns: [table.expenseId, table.userId] }),
]);

// 10. Settlement Table
export const settlement = pgTable("settlement", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trip.id).notNull(),
  fromUser: varchar("from_user", { length: 255 }).notNull(),
  toUser: varchar("to_user", { length: 255 }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  status: varchar("status", { length: 50 }).default("suggested").notNull(), // suggested, recorded
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
});
