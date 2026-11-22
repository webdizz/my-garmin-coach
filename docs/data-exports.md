# Garmin data exports (manual CSVs)

Exports from Garmin Connect, stored in `~/Downloads`. Used as a reference for what data exists and as
test fixtures once anonymised. **Do not commit real files.**

## Files

### `A dormir.csv` (sleep, one day)

Portuguese labels, key/value layout (not a table). Date `2026-11-22`.

Fields: sleep duration, SleepScore (85), quality (Bom), sleep factors, average stress (22),
deep / light / REM durations, awake time, restless moments (42), average overnight HR (50 bpm),
resting HR (44 bpm), Body Battery (+80).

Parsing notes:
- Two-column `Label,Value` pairs spread across sections (`Dados`, `Fatores`, `Métricas`).
- Durations are `6h 45m` style. Convert to minutes.
- Starts with a UTF-8 BOM (`\ufeff`). Strip it.

### `Peso.csv` (weight, one reading)

Header: `Tempo,Peso,Mudar,IMC,Gordura corporal,Massa muscular esquelética,Massa óssea,Água corporal`

Example: `9:20 AM, 81.2 kg, '+1.1 kg, 27.1, --, --, --, --`
- Body-composition columns are `--` for this reading (scale did not measure them, or not supported).
- `Mudar` is change vs previous reading, with a leading apostrophe and sign.
- Units embedded in values (`kg`). Strip and parse.
- Time has no date. Date must come from the export filename or context. **Gap: need a date column.**

### `activity_25151697270.csv` (pool swim, one activity)

Header (Portuguese): `Intervalos, Braçada (stroke type), Extensões (lengths), Distância, Tempo,
Tempo acumulado, Ritmo médio (pace), Melhor ritmo, Média de SWOLF, RC médio (heart rate avg),
RC máximo (heart rate max), Total de braçadas (total strokes), Média de braçadas, Calorias`

- First column blank, unnamed. Leading `""` in every row.
- Rows: rest intervals (`Descansar`) and swim intervals (`Mista`, `Bruços`, `Estilo livre`).
- Times like `15:09`, `1:03.8`, `0:19.1`. Paces like `3:02`. Parse `m:ss[.s]`.
- Missing values as `--`.
- Heart rate column is labelled `RC` (Ritmo cardíaco).

## Known gaps

- No date column in weight export.
- Sleep export is per-day, weight is per-reading. Need a consistent time-series schema.
- Confirm the API returns the same metrics so the CSVs can be retired.
