import { createParser } from "nuqs";
import { resolveBenefitsViewMonth } from "./benefits-view-month";
import { currentKstMonth, isValidBenefitsMonth } from "./kst-month";

export const parseAsBenefitsMonth = createParser({
  parse(queryValue) {
    if (!isValidBenefitsMonth(queryValue)) {
      return null;
    }
    if (resolveBenefitsViewMonth(queryValue) !== queryValue) {
      return null;
    }
    return queryValue;
  },
  serialize(value) {
    return value;
  },
}).withDefault(currentKstMonth());
