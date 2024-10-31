CREATE OR REPLACE FUNCTION public.get_formatted_tokens_period(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS SETOF formatted_tokens
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM set_config('my.p_start', p_start::text, true);
    PERFORM set_config('my.p_end', p_end::text, true);
    RETURN QUERY
    SELECT *
    FROM formatted_tokens;
END;
$function$;
