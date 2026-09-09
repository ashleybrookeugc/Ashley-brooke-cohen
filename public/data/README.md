# Screenshot-verified additions

The main tracker dataset remains `events.json`. `events-supplement.json` contains screenshot-discovered events verified after the occurrence-model migration. The tracker and detail views merge both files at runtime. Keep IDs unique across both files and deduplicate by underlying event, venue and occurrence date before adding new records.
