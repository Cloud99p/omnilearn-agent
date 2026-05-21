-- OmniLearn Neural Network Tables
-- For brain network visualization and analysis

-- 1. Network Neurons (knowledge nodes in the neural network)
CREATE TABLE IF NOT EXISTS network_neurons (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  tags TEXT[],
  weight DECIMAL(10, 6) DEFAULT 1.0,
  reinforcementCount INTEGER DEFAULT 0,
  accessCount INTEGER DEFAULT 0,
  isCore BOOLEAN DEFAULT false,
  sourceAgent VARCHAR(100),
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_network_neurons_type ON network_neurons(type);
CREATE INDEX idx_network_neurons_weight ON network_neurons(weight DESC);
CREATE INDEX idx_network_neurons_created_at ON network_neurons(createdAt DESC);

-- 2. Network Synapses (connections between neurons)
CREATE TABLE IF NOT EXISTS network_synapses (
  id SERIAL PRIMARY KEY,
  sourceId INTEGER REFERENCES network_neurons(id) ON DELETE CASCADE,
  targetId INTEGER REFERENCES network_neurons(id) ON DELETE CASCADE,
  weight DECIMAL(10, 6) DEFAULT 0.0,
  activationCount INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sourceId, targetId)
);

CREATE INDEX idx_network_synapses_source ON network_synapses(sourceId);
CREATE INDEX idx_network_synapses_target ON network_synapses(targetId);
CREATE INDEX idx_network_synapses_weight ON network_synapses(weight DESC);

-- 3. Network Agents (contributors to the network)
CREATE TABLE IF NOT EXISTS network_agents (
  id SERIAL PRIMARY KEY,
  agentId VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  totalContributions INTEGER DEFAULT 0,
  totalAccesses INTEGER DEFAULT 0,
  lastActiveAt TIMESTAMPTZ DEFAULT NOW(),
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_network_agents_contributions ON network_agents(totalContributions DESC);

-- 4. Network Pulses (activation events)
CREATE TABLE IF NOT EXISTS network_pulses (
  id SERIAL PRIMARY KEY,
  neuronId INTEGER REFERENCES network_neurons(id) ON DELETE CASCADE,
  agentId VARCHAR(100) REFERENCES network_agents(agentId),
  pulseType VARCHAR(50) DEFAULT 'activation', -- 'activation', 'reinforcement', 'decay'
  strength DECIMAL(10, 6) DEFAULT 1.0,
  metadata JSONB,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_network_pulses_neuron ON network_pulses(neuronId);
CREATE INDEX idx_network_pulses_agent ON network_pulses(agentId);
CREATE INDEX idx_network_pulses_created_at ON network_pulses(createdAt DESC);

-- 5. Add update trigger for network_neurons
CREATE OR REPLACE FUNCTION update_network_neurons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_network_neurons_updated_at
  BEFORE UPDATE ON network_neurons
  FOR EACH ROW
  EXECUTE FUNCTION update_network_neurons_updated_at();

COMMENT ON TABLE network_neurons IS 'Neurons in the neural network (knowledge nodes)';
COMMENT ON TABLE network_synapses IS 'Synapses/connections between neurons';
COMMENT ON TABLE network_agents IS 'Agents that contribute to the network';
COMMENT ON TABLE network_pulses IS 'Activation events (pulses) in the network';
