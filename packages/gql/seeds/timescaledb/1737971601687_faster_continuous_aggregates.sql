-- Faster continuous aggregates during testing
SELECT remove_continuous_aggregate_policy('api.candles_history_1min');
SELECT remove_continuous_aggregate_policy('api.token_stats_1h');

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
