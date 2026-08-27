alter table public.school_profiles
  add column if not exists school_phone text;

alter table public.school_profiles
  drop constraint if exists school_profiles_school_phone_length;

alter table public.school_profiles
  add constraint school_profiles_school_phone_length
  check (school_phone is null or char_length(school_phone) <= 60);
