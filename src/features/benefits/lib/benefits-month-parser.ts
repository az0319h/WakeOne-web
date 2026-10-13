import { createParser } from "nuqs";
import { currentKstMonth, isValidBenefitsMonth } from "./kst-month";

export const parseAsBenefitsMonth = createParser({
  parse(queryValue) {
    return isValidBenefitsMonth(queryValue) ? queryValue : null;
  },
  serialize(value) {
    return value;
  },
}).withDefault(currentKstMonth());
