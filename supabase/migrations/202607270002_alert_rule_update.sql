update public.nkh_alert_settings
set task_wait_minutes = 10,
    email_full_threshold = 10,
    cooldown_minutes = 60,
    updated_at = now()
where id = 'primary';
