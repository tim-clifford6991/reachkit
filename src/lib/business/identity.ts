// Who runs a site, as its structured data says: a local business, an
// organization or a person. The one list of those schema.org types; the
// name rule and the in-person reading take their types from it.
//
// Pure and import-free: type names in, a reading out, at 0¢.

/** `LocalBusiness` and every subtype of it, from schema.org v30.1
 *  (https://schema.org/version/30.1/schemaorg-current-https-types.csv). */
const LOCAL_BUSINESS_TYPES = [
  "AccountingService", "AdultEntertainment", "AmusementPark", "AnimalShelter", "ArchiveOrganization", "ArtGallery",
  "Attorney", "Audiology", "AutoBodyShop", "AutoDealer", "AutoPartsStore", "AutoRental", "AutoRepair", "AutoWash",
  "AutomatedTeller", "AutomotiveBusiness", "Bakery", "BankOrCreditUnion", "BarOrPub", "BeautySalon",
  "BedAndBreakfast", "BikeStore", "BookStore", "BowlingAlley", "Brewery", "CafeOrCoffeeShop", "Campground", "Casino",
  "ChildCare", "ClothingStore", "ComedyClub", "CommunityHealth", "ComputerStore", "ConvenienceStore",
  "CovidTestingFacility", "DaySpa", "Dentist", "DepartmentStore", "Dermatology", "DietNutrition", "Distillery",
  "DryCleaningOrLaundry", "Electrician", "ElectronicsStore", "Emergency", "EmergencyService", "EmploymentAgency",
  "EntertainmentBusiness", "ExerciseGym", "FastFoodRestaurant", "FinancialService", "FireStation", "Florist",
  "FoodEstablishment", "FurnitureStore", "GardenStore", "GasStation", "GeneralContractor", "Geriatric", "GolfCourse",
  "GovernmentOffice", "GroceryStore", "Gynecologic", "HVACBusiness", "HairSalon", "HardwareStore",
  "HealthAndBeautyBusiness", "HealthClub", "HobbyShop", "HomeAndConstructionBusiness", "HomeGoodsStore", "Hospital",
  "Hostel", "Hotel", "HousePainter", "IceCreamShop", "IndividualPhysician", "InsuranceAgency", "InternetCafe",
  "JewelryStore", "LegalService", "Library", "LiquorStore", "LocalBusiness", "Locksmith", "LodgingBusiness",
  "MedicalBusiness", "MedicalClinic", "MensClothingStore", "Midwifery", "MobilePhoneStore", "Motel",
  "MotorcycleDealer", "MotorcycleRepair", "MovieRentalStore", "MovieTheater", "MovingCompany", "MusicStore",
  "NailSalon", "NightClub", "Notary", "Nursing", "Obstetric", "OfficeEquipmentStore", "Oncologic", "Ophthalmology",
  "Optician", "Optometric", "Otolaryngologic", "OutletStore", "PawnShop", "Pediatric", "PetStore", "Pharmacy",
  "Physician", "PhysiciansOffice", "Physiotherapy", "PlasticSurgery", "Plumber", "Podiatric", "PoliceStation",
  "PostOffice", "PrimaryCare", "ProfessionalService", "Psychiatric", "PublicHealth", "PublicSwimmingPool",
  "RadioStation", "RealEstateAgent", "RecyclingCenter", "Resort", "Restaurant", "RoofingContractor", "SelfStorage",
  "ShoeStore", "ShoppingCenter", "SkiResort", "SportingGoodsStore", "SportsActivityLocation", "SportsClub",
  "StadiumOrArena", "Store", "TattooParlor", "TelevisionStation", "TennisComplex", "TireShop",
  "TouristInformationCenter", "ToyStore", "TravelAgency", "VacationRental", "WholesaleStore", "Winery",
] as const;

/** `Organization` and its subtypes that are not a `LocalBusiness`, from the
 *  same schema.org v30.1 file. */
const ORGANIZATION_TYPES = [
  "Airline", "CollegeOrUniversity", "Consortium", "Cooperative", "Corporation", "DanceGroup", "DiagnosticLab",
  "EducationalOrganization", "ElementarySchool", "FundingAgency", "FundingScheme", "GovernmentOrganization",
  "HighSchool", "LibrarySystem", "MedicalOrganization", "MiddleSchool", "MusicGroup", "NGO", "NewsMediaOrganization",
  "OnlineBusiness", "OnlineMarketplace", "OnlineStore", "Organization", "PerformingGroup", "PoliticalParty",
  "Preschool", "Project", "ResearchOrganization", "ResearchProject", "School", "SearchRescueOrganization",
  "SportsOrganization", "SportsTeam", "TheaterGroup", "VeterinaryCare", "WorkersUnion",
] as const;

export type IdentityType = (typeof LOCAL_BUSINESS_TYPES)[number] | (typeof ORGANIZATION_TYPES)[number] | "Person";
export type IdentityKind = "local_business" | "organization" | "person";

export interface Identity {
  kind: IdentityKind;
  /** The schema.org type, as schema.org spells it. */
  type: IdentityType;
}

/** The types whose `name` is the company's (the name rule's, issue 1380). */
export const NAMED_IDENTITY_TYPES: readonly IdentityType[] = ["Organization", "Corporation", "LocalBusiness", "OnlineBusiness"];

/** The types of a business carried out in person, where it is. A plain
 *  `LocalBusiness`, a `Store` or a `ProfessionalService` says only where it
 *  is (issue 1370). */
export const IN_PERSON_TYPES: readonly IdentityType[] = [
  "Restaurant", "FastFoodRestaurant", "CafeOrCoffeeShop", "Bakery", "BarOrPub", "Brewery", "Winery", "IceCreamShop",
  "FoodEstablishment", "Hotel", "Motel", "Hostel", "BedAndBreakfast", "LodgingBusiness", "Resort", "Plumber",
  "Electrician", "RoofingContractor", "HVACBusiness", "Locksmith", "HousePainter", "GeneralContractor",
  "HomeAndConstructionBusiness", "MovingCompany", "AutoRepair", "AutoBodyShop", "AutomotiveBusiness", "Dentist",
  "Physician", "MedicalClinic", "Optician", "Pharmacy", "VeterinaryCare", "BeautySalon", "HairSalon", "NailSalon",
  "DaySpa", "HealthAndBeautyBusiness", "ExerciseGym", "HealthClub", "ChildCare", "DryCleaningOrLaundry", "Florist",
  "TattooParlor",
];

/** The broad types a more specific one is preferred over. */
const ROOTS: ReadonlySet<string> = new Set(["LocalBusiness", "Organization"]);
const KIND_ORDER: readonly IdentityKind[] = ["local_business", "organization", "person"];

const BY_NAME: ReadonlyMap<string, Identity> = new Map([
  ...LOCAL_BUSINESS_TYPES.map((type): [string, Identity] => [type.toLowerCase(), { kind: "local_business", type }]),
  ...ORGANIZATION_TYPES.map((type): [string, Identity] => [type.toLowerCase(), { kind: "organization", type }]),
  ["person", { kind: "person", type: "Person" }],
]);

/** One type name as written (`Plumber`, `https://schema.org/Plumber`,
 *  `schema:Plumber`, any case), or `null` where it says nothing of who runs
 *  the site. */
function identityOfType(name: string): Identity | null {
  const bare = name.trim().replace(/\/+$/, "").split(/[/:#]/).pop() ?? "";
  return BY_NAME.get(bare.toLowerCase()) ?? null;
}

/** Who a page's structured data says runs the site: a local business over
 *  an organization over a person, and the most specific type of that kind.
 *  `null` where no type names one (`BreadcrumbList`, `WebSite`, …). */
export function identityOf(types: readonly string[]): Identity | null {
  const found = types.map(identityOfType).filter((i): i is Identity => i !== null);
  for (const kind of KIND_ORDER) {
    const ofKind = found.filter((i) => i.kind === kind);
    const best = ofKind.find((i) => !ROOTS.has(i.type)) ?? ofKind[0];
    if (best !== undefined) return best;
  }
  return null;
}

/** A schema type as a reader says it: `Plumber` → "a plumber",
 *  `HVACBusiness` → "an HVAC business", `NGO` → "an NGO". */
export function typeWords(type: string): string {
  const words = type
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()));
  const first = words[0] ?? "";
  const acronym = first.length > 1 && first === first.toUpperCase();
  const vowel = acronym ? /^[AEFHILMNORSX]/.test(first) : /^[aeiou]/.test(first);
  return `${vowel ? "an" : "a"} ${words.join(" ")}`;
}
