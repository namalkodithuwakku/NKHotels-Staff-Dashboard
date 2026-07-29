alter table public.nkh_properties
  add column if not exists calendar_sheet_code text;

create index if not exists nkh_properties_calendar_sheet_code_idx
  on public.nkh_properties (calendar_sheet_code)
  where calendar_sheet_code is not null;

comment on column public.nkh_properties.calendar_sheet_code is
  'Google Spreadsheet ID used by the read-only property calendar synchronization.';
