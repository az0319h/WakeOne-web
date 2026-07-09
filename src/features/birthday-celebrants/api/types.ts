export type BirthdayCelebrant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  birthday: string;
};

export type BirthdayCelebrantsResponse = {
  month: number;
  year: number;
  celebrants: BirthdayCelebrant[];
};
