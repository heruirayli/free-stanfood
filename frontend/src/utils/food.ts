// The food line on cards and details, e.g. "Pizza, snacks". Listings that only say
// food is provided, without naming any, read "Free food".
export const describeFood = (foodDetails: string | null): string =>
  foodDetails ? foodDetails.charAt(0).toUpperCase() + foodDetails.slice(1) : "Free food";
