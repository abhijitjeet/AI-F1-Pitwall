import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database('f1_pitwall.db');

// Enable WAL (Write-Ahead Logging) for fast SQLite performance
db.pragma('journal_mode = WAL');

// Helper function to read CSV into an array
function parseCSV<T = any>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const results: T[] = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

async function seedDatabase() {
    console.log('🏎️  Starting F1 Database Ingestion...\n');

    // 1. Create Tables with clean, explicit column names
    db.exec(`
    CREATE TABLE IF NOT EXISTS circuits (
      circuit_id INTEGER PRIMARY KEY,
      circuit_ref TEXT,
      name TEXT,
      location TEXT,
      country TEXT
    );

    CREATE TABLE IF NOT EXISTS drivers (
      driver_id INTEGER PRIMARY KEY,
      driver_ref TEXT,
      code TEXT,
      forename TEXT,
      surname TEXT,
      full_name TEXT,
      nationality TEXT
    );

    CREATE TABLE IF NOT EXISTS races (
      race_id INTEGER PRIMARY KEY,
      year INTEGER,
      round INTEGER,
      circuit_id INTEGER,
      name TEXT,
      race_date TEXT,
      FOREIGN KEY (circuit_id) REFERENCES circuits(circuit_id)
    );

    CREATE TABLE IF NOT EXISTS results (
      result_id INTEGER PRIMARY KEY,
      race_id INTEGER,
      driver_id INTEGER,
      grid_position INTEGER,
      finish_position INTEGER,
      points REAL,
      laps_completed INTEGER,
      FOREIGN KEY (race_id) REFERENCES races(race_id),
      FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
    );

    CREATE TABLE IF NOT EXISTS pit_stops (
      race_id INTEGER,
      driver_id INTEGER,
      stop_number INTEGER,
      lap INTEGER,
      duration_seconds REAL,
      duration_ms INTEGER,
      PRIMARY KEY (race_id, driver_id, stop_number),
      FOREIGN KEY (race_id) REFERENCES races(race_id),
      FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
    );
  `);

    const dataDir = path.join(__dirname, 'data');

    // 2. Load and Insert Circuits
    const circuits = await parseCSV(path.join(dataDir, 'circuits.csv'));
    const insertCircuit = db.prepare('INSERT OR REPLACE INTO circuits VALUES (?, ?, ?, ?, ?)');
    const seedCircuits = db.transaction((rows: any[]) => {
        for (const r of rows) {
            insertCircuit.run(
                parseInt(r.circuitId),
                r.circuitRef,
                r.name,
                r.location,
                r.country
            );
        }
    });
    seedCircuits(circuits);
    console.log(`✅ Loaded ${circuits.length} circuits.`);

    // 3. Load and Insert Drivers
    const drivers = await parseCSV(path.join(dataDir, 'drivers.csv'));
    const insertDriver = db.prepare('INSERT OR REPLACE INTO drivers VALUES (?, ?, ?, ?, ?, ?, ?)');
    const seedDrivers = db.transaction((rows: any[]) => {
        for (const r of rows) {
            const fullName = `${r.forename} ${r.surname}`;
            insertDriver.run(
                parseInt(r.driverId),
                r.driverRef,
                r.code,
                r.forename,
                r.surname,
                fullName,
                r.nationality
            );
        }
    });
    seedDrivers(drivers);
    console.log(`✅ Loaded ${drivers.length} drivers.`);

    // 4. Load and Insert Races
    const races = await parseCSV(path.join(dataDir, 'races.csv'));
    const insertRace = db.prepare('INSERT OR REPLACE INTO races VALUES (?, ?, ?, ?, ?, ?)');
    const seedRaces = db.transaction((rows: any[]) => {
        for (const r of rows) {
            insertRace.run(
                parseInt(r.raceId),
                parseInt(r.year),
                parseInt(r.round),
                parseInt(r.circuitId),
                r.name,
                r.date
            );
        }
    });
    seedRaces(races);
    console.log(`✅ Loaded ${races.length} races.`);

    // 5. Load and Insert Race Results
    const results = await parseCSV(path.join(dataDir, 'results.csv'));
    const insertResult = db.prepare('INSERT OR REPLACE INTO results VALUES (?, ?, ?, ?, ?, ?, ?)');
    const seedResults = db.transaction((rows: any[]) => {
        for (const r of rows) {
            insertResult.run(
                parseInt(r.resultId),
                parseInt(r.raceId),
                parseInt(r.driverId),
                r.grid === '\\N' ? null : parseInt(r.grid),
                r.positionOrder === '\\N' ? null : parseInt(r.positionOrder),
                r.points === '\\N' ? 0 : parseFloat(r.points),
                r.laps === '\\N' ? 0 : parseInt(r.laps)
            );
        }
    });
    seedResults(results);
    console.log(`✅ Loaded ${results.length} race results.`);

    // 6. Load and Insert Pit Stops
    const pitStops = await parseCSV(path.join(dataDir, 'pit_stops.csv'));
    const insertPitStop = db.prepare('INSERT OR REPLACE INTO pit_stops VALUES (?, ?, ?, ?, ?, ?)');
    const seedPitStops = db.transaction((rows: any[]) => {
        for (const r of rows) {
            insertPitStop.run(
                parseInt(r.raceId),
                parseInt(r.driverId),
                parseInt(r.stop),
                parseInt(r.lap),
                r.duration === '\\N' ? null : parseFloat(r.duration),
                r.milliseconds === '\\N' ? null : parseInt(r.milliseconds)
            );
        }
    });
    seedPitStops(pitStops);
    console.log(`✅ Loaded ${pitStops.length} pit stops.`);

    console.log('\n🏁 Success! SQLite database created at: f1_pitwall.db');
}

seedDatabase().catch((err) => {
    console.error('❌ Ingestion failed:', err);
});