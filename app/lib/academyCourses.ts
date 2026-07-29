export type AcademyCourse = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  categories: string[];
  tone: string;
};

export const ACADEMY_QUESTION_TARGET_PER_COURSE = 100;
export const ACADEMY_TOTAL_QUESTION_TARGET = 2400;

export const academyCourses: AcademyCourse[] = [
  {
    id: "reservations",
    name: "Reservations Essentials",
    shortName: "Reservations",
    description: "Booking terms, amendments, confirmations and reservation control.",
    categories: ["Reservations"],
    tone: "blue",
  },
  {
    id: "front-office",
    name: "Front Office Operations",
    shortName: "Front Office",
    description: "Arrival, departure, room assignment and daily desk operations.",
    categories: ["Front Office", "Room Types"],
    tone: "cyan",
  },
  {
    id: "guest-service",
    name: "Guest Service & Hotel English",
    shortName: "Guest Service",
    description: "Confident guest communication, service recovery and hospitality language.",
    categories: ["Guest Service", "Hospitality English"],
    tone: "green",
  },
  {
    id: "food-meal-plans",
    name: "Food & Meal Plans",
    shortName: "Meal Plans",
    description: "Hotel meal-plan terminology and common food-service formats.",
    categories: ["Meal Plans"],
    tone: "amber",
  },
  {
    id: "revenue-distribution",
    name: "Revenue, Rates & Distribution",
    shortName: "Revenue",
    description: "Rates, occupancy, restrictions, OTAs and distribution technology.",
    categories: ["Revenue Management", "Distribution"],
    tone: "indigo",
  },
  {
    id: "housekeeping",
    name: "Housekeeping Operations",
    shortName: "Housekeeping",
    description: "Room status, cleaning standards, linen and housekeeping coordination.",
    categories: ["Housekeeping"],
    tone: "teal",
  },
  {
    id: "payments",
    name: "Payments & Hotel Finance",
    shortName: "Payments",
    description: "Guest payments, deposits, invoices, refunds and hotel accounts.",
    categories: ["Payments"],
    tone: "violet",
  },
  {
    id: "sales-marketing",
    name: "Hotel Sales & Marketing",
    shortName: "Sales",
    description: "Leads, conversion, direct bookings, packages and hotel promotion.",
    categories: ["Sales and Marketing"],
    tone: "coral",
  },
  {
    id: "safety-security",
    name: "Safety & Security",
    shortName: "Safety",
    description: "Emergency awareness, incident reporting, privacy and guest protection.",
    categories: ["Safety and Security"],
    tone: "red",
  },
  {
    id: "food-beverage-service",
    name: "Food & Beverage Service",
    shortName: "F&B Service",
    description: "Restaurant terminology, service sequence, selling and banquet service.",
    categories: ["Food and Beverage Service"],
    tone: "amber",
  },
  {
    id: "food-safety",
    name: "Food Safety & Hygiene",
    shortName: "Food Safety",
    description: "Hygiene, allergens, temperatures and contamination prevention.",
    categories: ["Food Safety"],
    tone: "red",
  },
  {
    id: "laundry",
    name: "Laundry Operations",
    shortName: "Laundry",
    description: "Linen control, washing processes, quality and guest laundry.",
    categories: ["Laundry Operations"],
    tone: "cyan",
  },
  {
    id: "engineering",
    name: "Engineering & Maintenance",
    shortName: "Engineering",
    description: "Hotel assets, preventive maintenance, utilities and work orders.",
    categories: ["Engineering and Maintenance"],
    tone: "indigo",
  },
  {
    id: "events-banquets",
    name: "Events & Banquets",
    shortName: "Events",
    description: "Function planning, event documents, room setups and execution.",
    categories: ["Events and Banquets"],
    tone: "violet",
  },
  {
    id: "purchasing-inventory",
    name: "Purchasing & Inventory",
    shortName: "Purchasing",
    description: "Procurement, receiving, stock control and supplier management.",
    categories: ["Purchasing and Inventory"],
    tone: "green",
  },
  {
    id: "human-resources",
    name: "Hotel Human Resources",
    shortName: "HR",
    description: "Employment, induction, development and workplace procedures.",
    categories: ["Human Resources"],
    tone: "coral",
  },
  {
    id: "leadership",
    name: "Leadership & Supervision",
    shortName: "Leadership",
    description: "Briefings, handovers, coaching, delegation and accountability.",
    categories: ["Leadership and Supervision"],
    tone: "blue",
  },
  {
    id: "hotel-accounting",
    name: "Hotel Accounting",
    shortName: "Accounting",
    description: "Revenue, expenses, reconciliations, budgets and hotel profitability.",
    categories: ["Hotel Accounting"],
    tone: "green",
  },
  {
    id: "digital-marketing",
    name: "Digital Hotel Marketing",
    shortName: "Digital",
    description: "Search, social content, conversion and direct-booking strategy.",
    categories: ["Digital Marketing"],
    tone: "coral",
  },
  {
    id: "hotel-technology",
    name: "Hotel Technology & Data",
    shortName: "Technology",
    description: "PMS, integrations, permissions, security and data operations.",
    categories: ["Hotel Technology"],
    tone: "indigo",
  },
  {
    id: "sustainability",
    name: "Sustainable Hospitality",
    shortName: "Sustainability",
    description: "Energy, water, waste and responsible hotel operations.",
    categories: ["Sustainability"],
    tone: "teal",
  },
  {
    id: "quality-assurance",
    name: "Quality Assurance",
    shortName: "Quality",
    description: "Standards, inspections, audits and continuous improvement.",
    categories: ["Quality Assurance"],
    tone: "blue",
  },
  {
    id: "spa-wellness",
    name: "Spa & Wellness Operations",
    shortName: "Spa",
    description: "Consultations, treatment standards, hygiene and wellness service.",
    categories: ["Spa and Wellness"],
    tone: "violet",
  },
  {
    id: "concierge-transport",
    name: "Concierge & Transport",
    shortName: "Concierge",
    description: "Guest assistance, transfers, luggage and destination arrangements.",
    categories: ["Concierge and Transport"],
    tone: "cyan",
  },
];

export function academyCourse(value: unknown) {
  const id = String(value || "").trim().toLowerCase();
  return academyCourses.find(course => course.id === id) || academyCourses[0];
}
