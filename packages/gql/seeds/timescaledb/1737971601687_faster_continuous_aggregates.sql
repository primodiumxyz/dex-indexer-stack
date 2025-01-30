-- Seed the database during testing for faster continuous aggregates refresh

-- Remove existing policies
SELECT remove_continuous_aggregate_policy('api.candles_history_1min');
SELECT remove_continuous_aggregate_policy('api.token_stats_1h');

-- Add new policies with 1 second refresh interval for both 1min candles and 1h token stats
SELECT add_continuous_aggregate_policy('api.candles_history_1min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '0',
    schedule_interval => INTERVAL '1 second'
);

SELECT add_continuous_aggregate_policy('api.token_stats_1h',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '0', 
    schedule_interval => INTERVAL '1 second'
);
