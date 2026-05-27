const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running network schema migration...');
    
    // Add missing columns to network_agents
    await client.query(`
      ALTER TABLE network_agents 
        ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'observer',
        ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS unique_domains INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS domain_score REAL NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS submissions_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ratified_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS accuracy_score REAL NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS unique_relay_paths INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS topology_score REAL NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS age_multiplier REAL NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS total_contributions INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_reinforcements INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS days_active INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_self BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW()
    `);
    console.log('✓ network_agents columns added');
    
    // Add missing columns to network_pulses
    await client.query(`
      ALTER TABLE network_pulses
        ADD COLUMN IF NOT EXISTS neurons_affected INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS synapses_affected INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✓ network_pulses columns added');
    
    // Add missing columns to network_neurons
    await client.query(`
      ALTER TABLE network_neurons
        ADD COLUMN IF NOT EXISTS ratified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS ratification_quorum INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS positive_votes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS negative_votes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vote_score REAL NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS weighted_vote_score REAL NOT NULL DEFAULT 0.0
    `);
    console.log('✓ network_neurons columns added');
    
    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
