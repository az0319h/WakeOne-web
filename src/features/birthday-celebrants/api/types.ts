export type BirthdayCelebrant = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  birthday: string;
};

export type BirthdayCelebrantsResponse = {
  month: number;
  year: number;
  celebrants: BirthdayCelebrant[];
};
